const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    loginError.hidden = false;
    return;
  }

  loginError.hidden = true;
  localStorage.setItem("brainx_user_email", email);
  localStorage.setItem("brainx_logged_in", "true");
  window.location.href = "/chat";
});