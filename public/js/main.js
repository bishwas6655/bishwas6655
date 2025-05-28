// File: js/main.js
document.addEventListener('DOMContentLoaded', () => {
  // LOGIN
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ email, password })
        });
        const { success, message } = await res.json();
        if (success) {
          window.location.href = '/profile.html';
        } else {
          alert(message || 'Login failed');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred during login');
      }
    });
  }

  // REGISTER
  const registerForm = document.querySelector('.register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const data = {
        fullName: registerForm.fullName.value.trim(),
        email:    registerForm.email.value.trim(),
        phone:    registerForm.number.value.trim(),
        password: registerForm.password.value,
        confirm:  registerForm.confirmPassword.value,
        interest: registerForm.interest.value,
        state:    registerForm.state.value
      };
      if (data.password !== data.confirm) {
        return alert('Passwords do not match');
      }
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
        const { success, message } = await res.json();
        if (success) {
          window.location.href = '/success.html';
        } else {
          alert(message || 'Registration failed');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred during registration');
      }
    });
  }

  // CONTACT US
  const contactForm = document.querySelector('form[action=""]') || document.querySelector('.contact-form form') || document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.setAttribute('id','contact-form');
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();
      const form = contactForm;
      const payload = {
        firstName: form.firstName.value.trim(),
        lastName:  form.lastName.value.trim(),
        email:     form.email.value.trim(),
        interest:  form.interest.value,
        state:     form.state.value,
        message:   form.message.value.trim()
      };
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        const { success, message } = await res.json();
        if (success) {
          alert('Thank you! We’ll be in touch soon.');
          form.reset();
        } else {
          alert(message || 'Submission failed');
        }
      } catch (err) {
        console.error(err);
        alert('An error occurred sending your message');
      }
    });
  }
});
