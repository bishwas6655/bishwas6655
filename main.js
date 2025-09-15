// File: js/main.js
document.addEventListener('DOMContentLoaded', () => {
  const API = '';

  // =========================
  // Tiny fetch helpers
  // =========================
  const getToken = () => localStorage.getItem('token') || '';
  const setToken = (t) => { if (t) localStorage.setItem('token', t); };
  const clearToken = () => localStorage.removeItem('token');

  async function postJSON(path, body, { auth = false, signal } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (auth && token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(API + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
      signal
    }).catch(() => null);

    if (!res) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  }

  async function uploadFormData(path, formData, { auth = false, signal } = {}) {
    const headers = {};
    const token = getToken();
    if (auth && token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(API + path, {
      method: 'POST',
      headers,
      body: formData,
      signal
    }).catch(() => null);

    if (!res) return { ok: false };
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...data };
  }

  // LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
  let errorEl = document.getElementById('login-error');
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.id = 'login-error';
    errorEl.style.color = '#b42318';
    errorEl.style.marginTop = '8px';
    loginForm.appendChild(errorEl);
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.textContent = '';

    const email = loginForm.email.value.trim().toLowerCase();
    const password = loginForm.password.value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const { success, message } = await res.json();

      if (success) {
        localStorage.setItem('email', email); // <- used by steps
        window.location.href = '/profile.html';
      } else {
        errorEl.textContent = message || 'Invalid credentials';
      }
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Server error — please try again later';
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
  // make step1/2/3 know who this is
  try { localStorage.setItem('email', data.email.trim().toLowerCase()); } catch {}
  window.location.href = '/psychometric-step1.html';
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

// =========================
// Psychometric Steps
document.addEventListener('DOMContentLoaded', () => {
  // ===== Config =====
  const API = '';              // e.g. 'http://localhost:3000' if API is on another port
  const ENABLE_BACKEND = true; // flip false to test front-end only

  const emailForApi = () => localStorage.getItem('email') || '';

  // reuse the helpers you already defined earlier in the file:
  // getToken(), postJSON(), uploadFormData()

  // =========================
  // STEP 1  (psychometric-step1.html)
  // Form: #step1Form
  // =========================
  const step1Form = document.getElementById('step1Form');
  if (step1Form) {
    step1Form.addEventListener('submit', () => {
      const fd = new FormData(step1Form);
      const data = {};
      for (const [k, v] of fd.entries()) {
        if (data[k]) data[k] = [].concat(data[k], v);
        else data[k] = v;
      }
      ['desiredRoles', 'growthAreas'].forEach((n) => {
        data[n] = Array.from(step1Form.querySelectorAll(`input[name="${n}"]:checked`)).map(i => i.value);
      });
      try { localStorage.setItem('psychometricStep1', JSON.stringify(data)); } catch {}

      if (ENABLE_BACKEND) {
        data.email = emailForApi();
        postJSON('/api/questionnaire', data, { auth: true });
      }
      // no preventDefault; your page's own script handles next page
    }, { capture: true });
  }

  // =========================
  // STEP 2  (psychometric-step2.html)
  // Form: #step2Form
  // Inputs: #resumeInput, #certificatesInput, #extrasInput
  // Optional: #linkLinkedIn, #linkGithub, #linkPortfolio, #uploadNotes
  // =========================
  const step2Form = document.getElementById('step2Form');
  if (step2Form) {
    step2Form.addEventListener('submit', () => {
      const pick = (id) => {
        const el = document.getElementById(id);
        return el && el.files ? Array.from(el.files).map(f => ({ name: f.name, size: f.size, type: f.type })) : [];
      };
      const meta = {
        resume: pick('resumeInput'),
        certificates: pick('certificatesInput'),
        extras: pick('extrasInput'),
        links: {
          linkedin: document.getElementById('linkLinkedIn')?.value?.trim() || '',
          github:   document.getElementById('linkGithub')?.value?.trim()   || '',
          portfolio:document.getElementById('linkPortfolio')?.value?.trim()|| ''
        },
        notes: document.getElementById('uploadNotes')?.value?.trim() || ''
      };
      try { localStorage.setItem('psychometricStep2', JSON.stringify(meta)); } catch {}

      if (ENABLE_BACKEND) {
        const fd = new FormData();
        ['resumeInput', 'certificatesInput', 'extrasInput'].forEach((id) => {
          const el = document.getElementById(id);
          if (el && el.files) Array.from(el.files).forEach((f) => fd.append('files', f));
        });
        fd.append('meta', JSON.stringify(meta));
        fd.append('email', emailForApi()); // include email
        uploadFormData('/api/uploads', fd, { auth: true });
      }
      // no preventDefault; your page handles nav
    }, { capture: true });
  }

  // =========================
  // STEP 3  (psychometric-step3.html)
  // Form: #step3Form, checkboxes: input[name="services"]
  // =========================
  const step3Form = document.getElementById('step3Form');
  if (step3Form) {
    step3Form.addEventListener('submit', () => {
      const selected = Array.from(document.querySelectorAll('input[name="services"]:checked')).map(cb => cb.value);
      if (selected.length) {
        try { localStorage.setItem('psychometricStep3', JSON.stringify({ services: selected })); } catch {}

        if (ENABLE_BACKEND) {
          postJSON('/api/services', { email: emailForApi(), services: selected }, { auth: true });
        }
      }
      // no preventDefault; your toast+redirect runs
    }, { capture: true });
  }
});
