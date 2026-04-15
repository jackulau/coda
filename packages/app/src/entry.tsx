/* @refresh reload */
import { render } from "solid-js/web"
import { App } from "./app"
import "./styles.css"

window.addEventListener("error", (e) => {
  console.error("[renderer:error]", { message: e.message, file: e.filename, line: e.lineno })
})
window.addEventListener("unhandledrejection", (e) => {
  console.error("[renderer:unhandledrejection]", { reason: e.reason })
})

const root = document.getElementById("root")
if (!root) throw new Error("missing #root")
render(() => <App />, root)
