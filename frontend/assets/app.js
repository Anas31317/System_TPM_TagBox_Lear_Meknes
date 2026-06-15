/* ============================================
   Tag Box Lear — Logique commune
   Session (matricule/rôle), traductions FR/AR,
   horloge en direct, toasts.
   ============================================ */

const TagBoxApp = (function () {

  const SESSION_KEY = 'tagbox_session';
  const LANG_KEY = 'tagbox_lang';

  // ---------- Session ----------

  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Protège une page : redirige vers index.html si pas de session,
   * ou si le rôle ne correspond pas à celui attendu.
   */
  function requireSession(expectedRole) {
    const session = getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    if (expectedRole && session.role !== expectedRole) {
      window.location.href = session.role === 'technicien' ? 'technicien.html' : 'operateur.html';
      return null;
    }
    return session;
  }

  function logout() {
    clearSession();
    window.location.href = 'index.html';
  }

  // ---------- Langue ----------

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'fr';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
  }

  // ---------- Horloge ----------

  function startClock(elementIds) {
    const pad = n => String(n).padStart(2, '0');
    function tick() {
      const now = new Date();
      const s = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      elementIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = s;
      });
    }
    tick();
    return setInterval(tick, 1000);
  }

  // ---------- Toast ----------

  function showToast(message, type = 'success') {
    let toast = document.getElementById('tb-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tb-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    const icon = type === 'success' ? 'ti-check' : 'ti-alert-circle';
    toast.innerHTML = `<i class="ti ${icon}" aria-hidden="true"></i><span>${message}</span>`;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ---------- Traductions ----------

  const translations = {
    fr: {
      // Topbar / commun
      zoneOperateur: 'Tag Box — Zone Cutting',
      zoneTechnicien: 'Tag Box — Vue Technicien',
      langLabel: 'عربي',
      logout: 'Déconnexion',
      technicien: 'Technicien',
      operateur: 'Opérateur',
      matriculeShort: 'Matricule',

      // Login
      loginTitle: 'Connexion',
      loginLabel: 'Matricule',
      loginPlaceholder: 'Ex : 04721',
      loginBtn: 'Se connecter',
      loginHint: "Saisissez votre matricule pour accéder à la Tag Box. Aucun mot de passe requis.",
      loginErrorEmpty: 'Veuillez saisir votre matricule.',
      loginErrorFormat: 'Le matricule doit contenir 5 chiffres.',

      // Opérateur - tabs
      tab1: 'Nouveau signalement',
      tab2: 'Mes signalements',

      // Opérateur - formulaire
      title: 'Signaler un problème',
      sub: 'Remplissez les informations ci-dessous. Le technicien sera notifié automatiquement.',
      matricule: 'Matricule opérateur',
      matriculePh: 'Ex : 04721',
      machine: 'Machine / Poste',
      selectDef: '— Sélectionner —',
      date: 'Date et heure du signalement',
      dateNote: "L'heure est enregistrée automatiquement à l'envoi.",
      type: 'Type de problème',
      secLabel: 'Sécurité',
      secDesc: "Risque pour les personnes ou l'environnement",
      maiLabel: 'Maintenance',
      maiDesc: 'Anomalie machine ou équipement',
      proLabel: 'Production',
      proDesc: 'Gêne ou écart sur le flux de fabrication',
      problem: 'Problème constaté',
      problemPh: 'Décrivez le problème observé sur votre poste...',
      submit: 'Envoyer le signalement',
      sending: 'Envoi en cours...',

      // Validation
      errMachine: 'Veuillez sélectionner une machine.',
      errType: 'Veuillez choisir un type de problème.',
      errProblem: 'Veuillez décrire le problème.',
      successSent: 'Signalement envoyé avec succès.',

      // Mes signalements (opérateur)
      myTicketsTitle: 'Mes signalements',
      myTicketsSub: 'Historique de vos signalements et leur statut.',
      statusOuvert: 'En cours',
      statusResolu: 'Résolu',
      noTickets: "Vous n'avez envoyé aucun signalement pour le moment.",

      // Technicien
      tabEnCours: 'Tickets en cours',
      tabResolus: 'Tickets résolus',
      statTotal: 'Total ouverts',
      statSec: 'Sécurité',
      statMai: 'Maintenance',
      statPro: 'Production',
      sectionEnAttente: 'Signalements en attente',
      sectionResolus: 'Signalements résolus',
      filterTous: 'Tous',
      filterSec: 'Sécurité',
      filterMai: 'Maintenance',
      filterPro: 'Production',
      resolve: 'Résoudre',
      resolved: 'Résolu',
      noOpenTickets: 'Aucun signalement en attente pour ce filtre.',
      noResolvedTickets: 'Aucun signalement résolu pour le moment.',
      today: "Aujourd'hui",
      at: 'à',
      machineLabel: 'Machine',
      badgeSec: 'Sécurité',
      badgeMai: 'Maintenance',
      badgePro: 'Production'
    },
    ar: {
      zoneOperateur: 'صندوق البطاقات — قسم القطع',
      zoneTechnicien: 'صندوق البطاقات — واجهة الفني',
      langLabel: 'Français',
      logout: 'تسجيل الخروج',
      technicien: 'فني',
      operateur: 'عامل',
      matriculeShort: 'رقم الموظف',

      loginTitle: 'تسجيل الدخول',
      loginLabel: 'رقم الموظف',
      loginPlaceholder: 'مثال : 04721',
      loginBtn: 'تسجيل الدخول',
      loginHint: 'أدخل رقم موظفك للوصول إلى صندوق البطاقات. لا حاجة لكلمة مرور.',
      loginErrorEmpty: 'يرجى إدخال رقم الموظف.',
      loginErrorFormat: 'يجب أن يتكون رقم الموظف من 5 أرقام.',

      tab1: 'إبلاغ جديد',
      tab2: 'بلاغاتي',

      title: 'الإبلاغ عن مشكلة',
      sub: 'يرجى ملء المعلومات أدناه. سيتم إخطار الفني تلقائياً.',
      matricule: 'رقم الموظف',
      matriculePh: 'مثال : 04721',
      machine: 'الآلة / المحطة',
      selectDef: '— اختر —',
      date: 'تاريخ ووقت الإبلاغ',
      dateNote: 'يتم تسجيل الوقت تلقائياً عند الإرسال.',
      type: 'نوع المشكلة',
      secLabel: 'السلامة',
      secDesc: 'خطر على الأشخاص أو البيئة',
      maiLabel: 'الصيانة',
      maiDesc: 'خلل في الآلة أو المعدات',
      proLabel: 'الإنتاج',
      proDesc: 'عائق أو انحراف في خط التصنيع',
      problem: 'المشكلة الملاحظة',
      problemPh: 'صف المشكلة التي لاحظتها على محطتك...',
      submit: 'إرسال البلاغ',
      sending: 'جاري الإرسال...',

      errMachine: 'يرجى اختيار آلة.',
      errType: 'يرجى اختيار نوع المشكلة.',
      errProblem: 'يرجى وصف المشكلة.',
      successSent: 'تم إرسال البلاغ بنجاح.',

      myTicketsTitle: 'بلاغاتي',
      myTicketsSub: 'سجل بلاغاتك وحالتها.',
      statusOuvert: 'قيد المعالجة',
      statusResolu: 'تم الحل',
      noTickets: 'لم ترسل أي بلاغ حتى الآن.',

      tabEnCours: 'البلاغات الجارية',
      tabResolus: 'البلاغات المحلولة',
      statTotal: 'إجمالي المفتوحة',
      statSec: 'السلامة',
      statMai: 'الصيانة',
      statPro: 'الإنتاج',
      sectionEnAttente: 'البلاغات قيد الانتظار',
      sectionResolus: 'البلاغات المحلولة',
      filterTous: 'الكل',
      filterSec: 'السلامة',
      filterMai: 'الصيانة',
      filterPro: 'الإنتاج',
      resolve: 'حل',
      resolved: 'تم الحل',
      noOpenTickets: 'لا توجد بلاغات قيد الانتظار لهذا الفلتر.',
      noResolvedTickets: 'لا توجد بلاغات محلولة حتى الآن.',
      today: 'اليوم',
      at: 'الساعة',
      machineLabel: 'الآلة',
      badgeSec: 'السلامة',
      badgeMai: 'الصيانة',
      badgePro: 'الإنتاج'
    }
  };

  function t(key) {
    const lang = getLang();
    return (translations[lang] && translations[lang][key]) || translations.fr[key] || key;
  }

  return {
    setSession, getSession, clearSession, requireSession, logout,
    getLang, setLang,
    startClock,
    showToast,
    translations, t
  };
})();
