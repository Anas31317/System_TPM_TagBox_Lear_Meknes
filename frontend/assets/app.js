/* ============================================
   Tag Box Lear — Logique commune
   Session (matricule/rôle), traductions FR/AR,
   horloge en direct, toasts.
   ============================================ */

const TagBoxApp = (function () {

  const SESSION_KEY = 'tagbox_session';
  const LANG_KEY = 'tagbox_lang';

  // ---------- Session ----------
  // Gestion de la session utilisateur via sessionStorage (effacée à la fermeture du navigateur)

  // Stocke l'utilisateur connecté sous forme JSON (matricule, nom, rôle)
  function setSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  // Récupère la session actuelle ou null si pas connecté
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;  // JSON invalide ou vide
    }
  }

  // Efface la session (utilisé par logout)
  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Retourne l'URL de la page d'accueil selon le rôle
  // Utile pour les redirections après login ou lors de changement de rôle
  function homePage(role) {
    if (role === 'technicien') return 'technicien.html';
    if (role === 'chef_equipe') return 'chef_equipe.html';
    return 'operateur.html';  // Défaut : opérateur
  }

  // Vérifie que l'utilisateur est connecté et que son rôle correspond à la page demandée
  // Appelée au début de chaque page HTML pour protéger l'accès
  // Si pas de session → redirect vers login (index.html)
  // Si rôle ne correspond pas → redirect vers la bonne page du rôle
  function requireSession(expectedRole) {
    const session = getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    if (expectedRole && session.role !== expectedRole) {
      window.location.href = homePage(session.role);
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
      zoneChefEquipe: 'Tag Box — Vue Chef d\'équipe',
      langLabel: 'عربي',
      logout: 'Déconnexion',
      technicien: 'Technicien',
      operateur: 'Opérateur',
      chef_equipe: 'Chef d\'équipe',
      matriculeShort: 'Matricule',

      // Sélection du profil
      roleSelectTitle: 'Qui êtes-vous ?',
      roleSelectSub: 'Sélectionnez votre profil pour continuer.',
      roleOperateurDesc: 'Signaler un problème sur votre poste',
      roleTechnicienDesc: 'Consulter et résoudre les signalements',
      roleChefEquipeDesc: "Superviser les signalements et alimenter le plan d'action",
      backBtn: 'Retour',

      // Login
      loginTitle: 'Connexion',
      loginLabel: 'Matricule',
      loginPlaceholder: 'Ex : 04721',
      passwordLabel: 'Mot de passe',
      passwordPlaceholder: '••••••',
      loginBtn: 'Se connecter',
      loginHint: "Saisissez votre matricule et votre mot de passe pour accéder à la Tag Box.",
      loginErrorEmpty: 'Veuillez saisir votre matricule.',
      loginErrorFormat: 'Le matricule doit contenir 5 chiffres.',
      loginErrorPasswordEmpty: 'Veuillez saisir votre mot de passe.',
      loginErrorCredentials: 'Matricule ou mot de passe incorrect.',

      // Opérateur - tabs
      tab1: 'Nouveau signalement',
      tab2: 'Mes signalements',

      // Opérateur - formulaire
      title: 'Signaler une anomalie',
      sub: 'Remplissez les informations ci-dessous. Le technicien sera notifié automatiquement.',
      matricule: 'Matricule opérateur',
      matriculePh: 'Ex : 04721',
      machine: 'Machine',
      selectDef: '— Sélectionner —',
      date: 'Date et heure du signalement',
      dateNote: "L'heure est enregistrée automatiquement à l'envoi.",
      type: 'Type d\'anomalie',
      secLabel: 'Sécurité',
      secDesc: "Risque pour les personnes ou l'environnement",
      maiLabel: 'Maintenance',
      maiDesc: 'Anomalie machine ou équipement',
      proLabel: 'Production',
      proDesc: 'Gêne ou écart sur le flux de fabrication',
      problem: 'Anomalies Constatées',
      problemPh: 'Décrivez les anomalies constatées...',
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
      badgePro: 'Production',

      // Assignation technicien
      assignTicket: 'Prendre en charge',
      assignedByYou: 'Vous gérez ce ticket',
      assignedBy: 'Pris en charge par',

      // Modal de résolution
      resolveModalTitle: 'Marquer comme résolu',
      actionEffectueeLabel: 'Action effectuée (optionnel)',
      actionEffectueePh: "Décrivez l'intervention réalisée...",
      actionEffectueeShort: 'Action effectuée',
      cancel: 'Annuler',
      confirm: 'Confirmer',

      // Chef d'équipe
      resolvedBy: 'Résolu par',

      // Chef d'équipe — Analyse
      tabAnalyse: 'Analyse',
      sectionAnalyse: 'Suivi des interventions',
      chartEvolutionTitle: 'Évolution des interventions',
      chartTypesTitle: 'Répartition par type (tickets résolus)',
      seriesSignales: 'Signalés',
      seriesResolus: 'Résolus',
      tableMachinesTitle: 'Machines à surveiller',
      tableTechsTitle: 'Charge par technicien',
      colTotal: 'Total',
      colTicketsResolus: 'Tickets résolus',
      noAnalyticsData: 'Pas encore assez de données pour cette analyse.',
      range7: '7 jours',
      range14: '14 jours',
      range1m: '1 mois',
      range3m: '3 mois',
      range6m: '6 mois',

      // Filtres date
      dateFrom: 'De',
      dateTo: 'À',
      filterByDate: 'Filtrer par date',
      noDataToExport: 'Aucune donnée à exporter.',
      csvType: 'Type',
      description: 'Description',
      csvDate: 'Date signalement',
      csvHeure: 'Heure signalement',
      csvMatriculeOp: 'Matricule opérateur',
      csvDateResolution: 'Date résolution',
      csvHeureResolution: 'Heure résolution'
    },
    ar: {
      zoneOperateur: 'صندوق البطاقات — قسم القطع',
      zoneTechnicien: 'صندوق البطاقات — واجهة الفني',
      zoneChefEquipe: 'صندوق البطاقات — واجهة رئيس الفريق',
      langLabel: 'Français',
      logout: 'تسجيل الخروج',
      technicien: 'فني',
      operateur: 'عامل',
      chef_equipe: 'رئيس الفريق',
      matriculeShort: 'رقم الموظف',

      roleSelectTitle: 'من أنت؟',
      roleSelectSub: 'اختر ملفك الشخصي للمتابعة.',
      roleOperateurDesc: 'الإبلاغ عن مشكلة في محطتك',
      roleTechnicienDesc: 'عرض البلاغات وحلها',
      roleChefEquipeDesc: 'متابعة البلاغات وتغذية خطة العمل',
      backBtn: 'رجوع',

      loginTitle: 'تسجيل الدخول',
      loginLabel: 'رقم الموظف',
      loginPlaceholder: 'مثال : 04721',
      passwordLabel: 'كلمة المرور',
      passwordPlaceholder: '••••••',
      loginBtn: 'تسجيل الدخول',
      loginHint: 'أدخل رقم موظفك وكلمة المرور للوصول إلى صندوق البطاقات.',
      loginErrorEmpty: 'يرجى إدخال رقم الموظف.',
      loginErrorFormat: 'يجب أن يتكون رقم الموظف من 5 أرقام.',
      loginErrorPasswordEmpty: 'يرجى إدخال كلمة المرور.',
      loginErrorCredentials: 'رقم الموظف أو كلمة المرور غير صحيحة.',

      tab1: 'إبلاغ جديد',
      tab2: 'بلاغاتي',

      title: 'الإبلاغ عن أعطال',
      sub: 'يرجى ملء المعلومات أدناه. سيتم إخطار الفني تلقائياً.',
      matricule: 'رقم الموظف',
      matriculePh: 'مثال : 04721',
      machine: 'الآلة',
      selectDef: '— اختر —',
      date: 'تاريخ ووقت الإبلاغ',
      dateNote: 'يتم تسجيل الوقت تلقائياً عند الإرسال.',
      type: 'نوع العطل',
      secLabel: 'السلامة',
      secDesc: 'خطر على الأشخاص أو البيئة',
      maiLabel: 'الصيانة',
      maiDesc: 'خلل في الآلة أو المعدات',
      proLabel: 'الإنتاج',
      proDesc: 'عائق أو انحراف في خط التصنيع',
      problem: 'الأعطال المكتشفة',
      problemPh: 'صف الأعطال المكتشفة على محطتك...',
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
      badgePro: 'الإنتاج',

      // Assignation technicien
      assignTicket: 'تولّ المسؤولية',
      assignedByYou: 'أنت من يتولى هذا البلاغ',
      assignedBy: 'تولى المسؤولية',

      resolveModalTitle: 'وضع علامة "محلول"',
      actionEffectueeLabel: 'الإجراء المتخذ (اختياري)',
      actionEffectueePh: 'صف التدخل الذي قمت به...',
      actionEffectueeShort: 'الإجراء المتخذ',
      cancel: 'إلغاء',
      confirm: 'تأكيد',

      resolvedBy: 'تم الحل من طرف',

      tabAnalyse: 'تحليل',
      sectionAnalyse: 'تتبع التدخلات',
      chartEvolutionTitle: 'تطور التدخلات',
      chartTypesTitle: 'التوزيع حسب النوع (البلاغات المحلولة)',
      seriesSignales: 'المعلنة',
      seriesResolus: 'المحلولة',
      tableMachinesTitle: 'الآلات التي تستوجب المراقبة',
      tableTechsTitle: 'توزيع العمل على الفنيين',
      colTotal: 'الإجمالي',
      colTicketsResolus: 'البلاغات المحلولة',
      noAnalyticsData: 'لا توجد بيانات كافية لهذا التحليل حتى الآن.',
      range7: '7 أيام',
      range14: '14 يوماً',
      range1m: 'شهر واحد',
      range3m: '3 أشهر',
      range6m: '6 أشهر',

      // رئيس الفريق — تصدير CSV
      exportCsv: 'تصدير CSV',
      // مرشحات التاريخ
      dateFrom: 'من',
      dateTo: 'إلى',
      filterByDate: 'تصفية حسب التاريخ',
      noDataToExport: 'لا توجد بيانات للتصدير.',
      csvType: 'النوع',
      description: 'الوصف',
      csvDate: 'تاريخ البلاغ',
      csvHeure: 'وقت البلاغ',
      csvMatriculeOp: 'رقم موظف العامل',
      csvDateResolution: 'تاريخ الحل',
      csvHeureResolution: 'وقت الحل'
    }
  };

  function t(key) {
    const lang = getLang();
    return (translations[lang] && translations[lang][key]) || translations.fr[key] || key;
  }

  return {
    setSession, getSession, clearSession, requireSession, logout, homePage,
    getLang, setLang,
    startClock,
    showToast,
    translations, t
  };
})();
