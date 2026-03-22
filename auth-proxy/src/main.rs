use axum::{
    extract::State,
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

struct Config {
    fusionauth_url: String,
    client_id: String,
    app_url: String,
    secure: bool,
}

const COOKIE_NAME: &str = "rz_rt";
const MAX_AGE: u32 = 60 * 60 * 24 * 30; // 30 days

fn build_cookie(value: &str, secure: bool, clear: bool) -> String {
    let age = if clear {
        "Max-Age=0".to_string()
    } else {
        format!("Max-Age={MAX_AGE}")
    };
    let mut parts = vec![
        format!("{COOKIE_NAME}={value}"),
        "HttpOnly".into(),
        "SameSite=Strict".into(),
        "Path=/auth/".into(),
        age,
    ];
    if secure {
        parts.push("Secure".into());
    }
    parts.join("; ")
}

fn extract_cookie(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get("cookie")?.to_str().ok()?;
    raw.split(';').find_map(|part| {
        let (k, v) = part.trim().split_once('=')?;
        (k == name).then(|| v.to_string())
    })
}

type SharedState = (Arc<Config>, reqwest::Client);

#[derive(Deserialize)]
struct TokenBody {
    code: String,
    #[serde(rename = "codeVerifier")]
    code_verifier: String,
}

#[derive(Serialize)]
struct AccessTokenResponse {
    access_token: String,
}

#[derive(Deserialize)]
struct FaTokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
}

async fn fa_exchange(
    client: &reqwest::Client,
    url: &str,
    params: &[(&str, &str)],
) -> Result<FaTokenResponse, (StatusCode, String)> {
    let res = client
        .post(url)
        .form(params)
        .send()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        return Err((
            StatusCode::BAD_GATEWAY,
            format!("FusionAuth {status}: {body}"),
        ));
    }

    res.json()
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e.to_string()))
}

fn set_cookie_header(value: &str, secure: bool, clear: bool) -> HeaderMap {
    let mut headers = HeaderMap::new();
    let cookie = build_cookie(value, secure, clear);
    headers.insert("Set-Cookie", HeaderValue::from_str(&cookie).unwrap());
    headers
}

async fn handle_token(
    State((cfg, client)): State<SharedState>,
    Json(body): Json<TokenBody>,
) -> Response {
    let url = format!("{}/oauth2/token", cfg.fusionauth_url);
    let redirect_uri = format!("{}/callback", cfg.app_url);
    let params = [
        ("grant_type", "authorization_code"),
        ("client_id", cfg.client_id.as_str()),
        ("code", body.code.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("code_verifier", body.code_verifier.as_str()),
    ];

    match fa_exchange(&client, &url, &params).await {
        Ok(fa) => {
            let (Some(access_token), Some(refresh_token)) = (fa.access_token, fa.refresh_token)
            else {
                return (
                    StatusCode::BAD_GATEWAY,
                    "missing tokens in FusionAuth response",
                )
                    .into_response();
            };
            let headers = set_cookie_header(&refresh_token, cfg.secure, false);
            (headers, Json(AccessTokenResponse { access_token })).into_response()
        }
        Err((status, msg)) => (status, msg).into_response(),
    }
}

async fn handle_refresh(State((cfg, client)): State<SharedState>, headers: HeaderMap) -> Response {
    let Some(refresh_token) = extract_cookie(&headers, COOKIE_NAME) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "no_session"})),
        )
            .into_response();
    };

    let url = format!("{}/oauth2/token", cfg.fusionauth_url);
    let params = [
        ("grant_type", "refresh_token"),
        ("client_id", cfg.client_id.as_str()),
        ("refresh_token", refresh_token.as_str()),
    ];

    match fa_exchange(&client, &url, &params).await {
        Ok(fa) => {
            let (Some(access_token), Some(new_refresh)) = (fa.access_token, fa.refresh_token)
            else {
                return (
                    StatusCode::BAD_GATEWAY,
                    "missing tokens in FusionAuth response",
                )
                    .into_response();
            };
            let headers = set_cookie_header(&new_refresh, cfg.secure, false);
            (headers, Json(AccessTokenResponse { access_token })).into_response()
        }
        Err((status, msg)) => (status, msg).into_response(),
    }
}

async fn handle_logout(State((cfg, _)): State<SharedState>) -> Response {
    let headers = set_cookie_header("", cfg.secure, true);
    (StatusCode::NO_CONTENT, headers).into_response()
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let fusionauth_url = std::env::var("FUSIONAUTH_URL").expect("FUSIONAUTH_URL is required");
    let client_id =
        std::env::var("FUSIONAUTH_CLIENT_ID").expect("FUSIONAUTH_CLIENT_ID is required");
    let app_url = std::env::var("APP_URL").expect("APP_URL is required");
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "4000".into())
        .parse()
        .expect("PORT must be a number");
    let secure = app_url.starts_with("https://");

    let cfg = Arc::new(Config {
        fusionauth_url,
        client_id,
        app_url,
        secure,
    });
    let client = reqwest::Client::new();

    let app = Router::new()
        .route("/auth/token", post(handle_token))
        .route("/auth/refresh", post(handle_refresh))
        .route("/auth/logout", post(handle_logout))
        .with_state((cfg.clone(), client));

    let addr = format!("0.0.0.0:{port}");
    println!("auth-proxy :{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
