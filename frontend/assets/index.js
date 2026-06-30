// ============================================
// Tag Box Lear — Page de connexion (index.html)
// Gère la sélection du rôle et l'authentification
// en deux étapes : choix du profil → saisie des identifiants
// ============================================

// Redirection automatique si une session active existe déjà
// (l'utilisateur a déjà cliqué "Se connecter" lors d'une session précédente)
// sessionStorage est effacé à la fermeture du navigateur — pas de risque de session persistante
(function () {
  const session = TagBoxApp.getSession();
  if (session) {
    window.location.href = TagBoxApp.homePage(session.role);
  }
})();

let selectedRole = null;

// On stocke les CLÉs de traduction (ex: 'loginErrorEmpty') plutôt que le texte brut,
// pour pouvoir re-afficher les messages traduits si l'utilisateur change de langue en cours de saisie
const errorKeys = { matricule: null, password: null };

// ---------- Traductions ----------
// Appelée à l'initialisation et à chaque changement de langue
// Met à jour tous les textes visibles de la page
function applyTranslations() {
  const t = TagBoxApp.t;
  const lang = TagBoxApp.getLang();
  const wrap = document.getElementById('login-wrap');
  // Bascule la classe 'ar' sur le conteneur pour activer le CSS RTL (direction: rtl)
  lang === 'ar' ? wrap.classList.add('ar') : wrap.classList.remove('ar');
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.getElementById('t-role-title').textContent = t('roleSelectTitle');
  document.getElementById('t-role-sub').textContent = t('roleSelectSub');
  document.getElementById('t-role-operateur').textContent = t('operateur');
  document.getElementById('t-role-operateur-desc').textContent = t('roleOperateurDesc');
  document.getElementById('t-role-technicien').textContent = t('technicien');
  document.getElementById('t-role-technicien-desc').textContent = t('roleTechnicienDesc');
  document.getElementById('t-role-chef_equipe').textContent = t('chef_equipe');
  document.getElementById('t-role-chef_equipe-desc').textContent = t('roleChefEquipeDesc');
  document.getElementById('t-back').textContent = t('backBtn');

  document.getElementById('t-login-label').textContent = t('loginLabel');
  document.getElementById('i-matricule').placeholder = t('loginPlaceholder');
  document.getElementById('t-password-label').textContent = t('passwordLabel');
  document.getElementById('i-password').placeholder = t('passwordPlaceholder');
  document.getElementById('t-login-btn').textContent = t('loginBtn');
  document.getElementById('t-login-hint').textContent = t('loginHint');
  document.getElementById('lang-label').textContent = t('langLabel');

  // Le titre de la vue login inclut le rôle sélectionné (ex: "Connexion — Technicien")
  document.getElementById('t-login-title').textContent = selectedRole
    ? `${t('loginTitle')} — ${t(selectedRole)}`
    : t('loginTitle');

  // Re-afficher les erreurs existantes dans la nouvelle langue
  setError('matricule', errorKeys.matricule);
  setError('password', errorKeys.password);
}

// ---------- Navigation entre les vues ----------
// Étape 1 → 2 : l'utilisateur a choisi son rôle, on affiche le formulaire de connexion
function selectRole(role) {
  selectedRole = role;
  document.getElementById('view-role-select').style.display = 'none';
  document.getElementById('view-login').style.display = '';
  resetForm();
  applyTranslations();
  document.getElementById('i-matricule').focus();
}

// Retour étape 2 → 1 : l'utilisateur veut changer de rôle
function showRoleSelect() {
  selectedRole = null;
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('view-role-select').style.display = '';
  resetForm();
}

function resetForm() {
  document.getElementById('i-matricule').value = '';
  document.getElementById('i-password').value = '';
  setError('matricule', null);
  setError('password', null);
}

// ---------- Erreurs de champ ----------
// Affiche ou masque un message d'erreur sous un champ
// `key` est une clé de traduction (ex: 'loginErrorEmpty') stockée pour re-traduire à la volée
function setError(field, key) {
  const errEl = document.getElementById(`err-${field}`);
  const input = document.getElementById(`i-${field}`);
  errorKeys[field] = key;
  if (key) {
    errEl.textContent = TagBoxApp.t(key);
    errEl.classList.add('visible');
    input.classList.add('invalid'); // bordure rouge sur le champ
  } else {
    errEl.classList.remove('visible');
    input.classList.remove('invalid');
  }
}

// ---------- Connexion ----------
async function handleLogin() {
  const matriculeInput = document.getElementById('i-matricule');
  const passwordInput = document.getElementById('i-password');
  const matricule = matriculeInput.value.trim();
  const password = passwordInput.value;

  let valid = true;

  if (!matricule) {
    setError('matricule', 'loginErrorEmpty');
    valid = false;
  } else if (!/^\d{4,6}$/.test(matricule)) {
    // Le matricule Lear est un code numérique de 4 à 6 chiffres
    setError('matricule', 'loginErrorFormat');
    valid = false;
  } else {
    setError('matricule', null);
  }

  if (!password) {
    setError('password', 'loginErrorPasswordEmpty');
    valid = false;
  } else {
    setError('password', null);
  }

  if (!valid) return;

  // Désactiver le bouton pendant la requête pour éviter les doubles soumissions
  const btn = document.getElementById('login-btn');
  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>';

  try {
    const { ok, user } = await TagBoxAPI.login(matricule, password, selectedRole);

    if (!ok) {
      // Le serveur a répondu mais a refusé les identifiants (mauvais mdp ou rôle incorrect)
      btn.disabled = false;
      btn.innerHTML = originalContent;
      setError('password', 'loginErrorCredentials');
      return;
    }

    // Succès : on sauvegarde la session et on redirige vers la page du rôle
    TagBoxApp.setSession(user);
    window.location.href = TagBoxApp.homePage(user.role);

  } catch (e) {
    // Erreur réseau (Flask pas démarré, serveur inaccessible)
    btn.disabled = false;
    btn.innerHTML = originalContent;
    TagBoxApp.showToast('Erreur de connexion. Réessayez.', 'error');
  }
}

function toggleLang() {
  const current = TagBoxApp.getLang();
  TagBoxApp.setLang(current === 'fr' ? 'ar' : 'fr');
  applyTranslations();
}

// Soumission par Entrée + effacement de l'erreur à la frappe
['i-matricule', 'i-password'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  el.addEventListener('input', () => setError(id.replace('i-', ''), null));
});

applyTranslations();
