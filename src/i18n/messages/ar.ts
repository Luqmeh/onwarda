export const ar = {
  appName: "Onwarda",
  contexts: {
    admin: "الإدارة الداخلية",
    client: "مساحة العميل",
    guest: "بوابة الضيف",
  },
  auth: {
    signIn: "تسجيل الدخول",
    signOut: "تسجيل الخروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    required: "يلزم تسجيل الدخول.",
  },
  states: {
    loading: "جارٍ التحميل",
    empty: "لا يوجد شيء للعرض بعد.",
    error: "حدث خطأ ما.",
    success: "تم الحفظ.",
    accessDenied: "تم رفض الوصول.",
  },
} as const;
