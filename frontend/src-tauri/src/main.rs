#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  process::{Child, Command},
  sync::Mutex,
  time::Duration,
};

use tauri::{AppHandle, Manager, RunEvent};
use tauri::api::process::Command as TauriCommand;

struct BackendState(Mutex<Option<Child>>);

fn spawn_backend(app: &AppHandle) -> anyhow::Result<Child> {
  // caminho do bin empacotado
  let backend_path = app
    .path()
    .resolve("bin/auto_cl_backend.exe", tauri::path::BaseDirectory::Resource)?;

  // sobe o EXE
  let child = Command::new(backend_path)
    // se o seu run_backend aceita args, coloque aqui
    // .arg("--port").arg("8000")
    .spawn()?;

  Ok(child)
}

fn wait_health() -> bool {
  // sem dependências extras (usa reqwest blocking? não queremos)
  // então faz ping usando std + ureq seria externo.
  // Como Tauri já roda com tokio em muitos setups, mas vamos simplificar usando minreq (não incluso).
  // ✅ solução simples: usa o próprio plugin http do webview depois.
  // Aqui vamos usar `ureq`? Não. Então faremos uma espera cega curta + retry via std::net.
  // Melhor: usar `std::net::TcpStream` para ver se porta abriu.

  for _ in 0..120 {
    if std::net::TcpStream::connect(("127.0.0.1", 8000)).is_ok() {
      // porta abriu; agora dá mais um tempinho pro Django responder
      std::thread::sleep(Duration::from_millis(300));
      return true;
    }
    std::thread::sleep(Duration::from_millis(250));
  }
  false
}

fn main() {
  tauri::Builder::default()
    .manage(BackendState(Mutex::new(None)))
    .setup(|app| {
      // 1) spawn do backend
      let child = spawn_backend(&app.handle()).expect("Falha ao iniciar backend");
      {
        let state: tauri::State<BackendState> = app.state();
        *state.0.lock().unwrap() = Some(child);
      }

      // 2) aguarda servidor subir (porta 8000)
      let ok = wait_health();
      if !ok {
        eprintln!("Backend não subiu na porta 8000 a tempo.");
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app_handle, event| match event {
      RunEvent::ExitRequested { api, .. } => {
        api.prevent_exit();
        // mata backend antes de sair
        let state: tauri::State<BackendState> = app_handle.state();
        if let Some(mut child) = state.0.lock().unwrap().take() {
          let _ = child.kill();
        }
        std::process::exit(0);
      }
      _ => {}
    });
}