/**
 * Runs once when the server starts. Requests the home page so the feeds load (and titles
 * get translated) before the first visitor arrives. It goes through HTTP on purpose: the
 * pages keep their own cache, separate from this file's copy of the code.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.MOCK_FEEDS === "1") return;
  const port = process.env.PORT || 3000;
  setTimeout(() => {
    fetch(`http://127.0.0.1:${port}/`).catch(() => {});
  }, 1500);
}
