"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Check, ChevronDown, Moon, Sun, ArrowLeft, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import type { Locale } from "@/lib/i18n/config";
import { useAuth } from "@/lib/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { getPaddle } from "@/lib/paddle/paddle-loader";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="255.5" cy="255.5" r="200.5" fill="currentColor" />
      <defs>
        <clipPath id="circleClip">
          <circle cx="255.5" cy="255.5" r="200.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#circleClip)">
        <line
          x1="380.529"
          y1="98.0623"
          x2="222.334"
          y2="256.257"
          className="stroke-white dark:stroke-[#25242a]"
          strokeWidth="48"
          strokeLinecap="round"
        />
        <line
          x1="388.987"
          y1="423.362"
          x2="223.529"
          y2="257.904"
          className="stroke-white dark:stroke-[#25242a]"
          strokeWidth="48"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

type PricingTranslations = {
  backHome: string;
  title: string;
  subtitle: string;
  trial: string;
  trialPrice: string;
  trialPeriod: string;
  trialDesc: string;
  trialBtn: string;
  trialFeature1: string;
  trialFeature2: string;
  trialFeature3: string;
  pro: string;
  proPrice: string;
  proPeriod: string;
  proDesc: string;
  proBtn: string;
  proFeature1: string;
  proFeature2: string;
  proFeature3: string;
  proFeature4: string;
  proFeature5: string;
  proFeature6: string;
  proFeature7: string;
  proFeature8: string;
  included: string;
  popular: string;
  noCard: string;
  autoRenew: string;
  faqTitle: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqQ4: string;
  faqA4: string;
  securePaddle: string;
};

const localDict: Record<Locale, PricingTranslations> = {
  en: {
    backHome: "Back to Orkest",
    title: "Simple, transparent pricing",
    subtitle: "Try Orkest free for 7 days, then upgrade to continue organizing your tasks and time with powerful AI features.",
    trial: "7-Day Free Trial",
    trialPrice: "$0",
    trialPeriod: "for 7 days",
    trialDesc: "Experience the full power of Orkest before making a decision. No credit card required upfront.",
    trialBtn: "Start Free Trial",
    trialFeature1: "7 days of full Pro access (50 AI messages/day)",
    trialFeature2: "No credit card required upfront",
    trialFeature3: "Sync across all your devices",
    pro: "Orkest Pro",
    proPrice: "$9.99",
    proPeriod: "/ month",
    proDesc: "Unlock everything and orchestrate your tasks and time seamlessly across all devices.",
    proBtn: "Upgrade to Pro",
    proFeature1: "Everything in the Free Trial",
    proFeature2: "Continuous AI Scheduling & assistant (200 AI messages/day)",
    proFeature3: "Unlimited focus sessions & analytics",
    proFeature4: "Advanced offline synchronization",
    proFeature5: "Custom recurrence & priority tags",
    proFeature6: "AI Memory that learns your work habits",
    proFeature7: "Daily personalized email digest",
    proFeature8: "Premium support & updates",
    included: "What's included",
    popular: "MOST POPULAR",
    noCard: "No card required upfront",
    autoRenew: "Billed monthly, cancel anytime",
    faqTitle: "Frequently Asked Questions",
    faqQ1: "Can I cancel my subscription at any time?",
    faqA1: "Yes! You can cancel your subscription at any time through the billing portal in settings. You will retain access to Orkest Pro until the end of your current billing cycle.",
    faqQ2: "How does the 7-day free trial work?",
    faqA2: "You can sign up and try Orkest Pro for 7 days completely free, no credit card required. At the end of the trial, you can choose to subscribe to Pro to keep your advanced features active. Otherwise, your account will transition to a basic read-only mode, and no charges will occur.",
    faqQ3: "Can I use Orkest on multiple devices?",
    faqA3: "Yes, absolutely! With an active trial or Orkest Pro subscription, you can log in on as many devices as you like. Your tasks, schedule, and settings will automatically sync in real-time.",
    faqQ4: "What forms of payment do you support?",
    faqA4: "We support all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay, depending on your region and country.",
    securePaddle: "Secure payment processing powered by Paddle",
  },
  "zh-CN": {
    backHome: "返回 Orkest 首页",
    title: "简单透明的定价",
    subtitle: "免费试用 Orkest 7 天，然后升级以继续使用强大的 AI 功能规划您的任务与时间。",
    trial: "7天免费试用",
    trialPrice: "$0",
    trialPeriod: "试用 7 天",
    trialDesc: "在做决定前体验 Orkest 的全部功能。无需预先绑定信用卡。",
    trialBtn: "开始免费试用",
    trialFeature1: "7 天完全专业版访问权限 (每天 50 次 AI 对话)",
    trialFeature2: "无需绑定信用卡",
    trialFeature3: "跨设备多端实时同步",
    pro: "Orkest 专业版",
    proPrice: "$9.99",
    proPeriod: "/ 月",
    proDesc: "解锁所有功能，在所有设备上无缝规划您的任务和时间。",
    proBtn: "升级为专业版",
    proFeature1: "包含免费试用期所有功能",
    proFeature2: "持续的 AI 日程管理与助理服务 (每天 200 次 AI 对话)",
    proFeature3: "无限次数的专注时段与数据分析",
    proFeature4: "高级离线同步与冲突解决机制",
    proFeature5: "自定义循环任务与优先级标签",
    proFeature6: "AI 记忆，越用越懂你",
    proFeature7: "每日个性化邮件摘要",
    proFeature8: "尊享技术支持与优先更新",
    included: "包含功能",
    popular: "最受欢迎",
    noCard: "无需绑定信用卡",
    autoRenew: "按月计费，可随时取消",
    faqTitle: "常见问题解答",
    faqQ1: "我可以随时取消订阅吗？",
    faqA1: "可以！您可以随时通过设置中的账单门户取消订阅。取消后，您仍可使用 Orkest 专业版直至当前计费周期结束。",
    faqQ2: "7 天免费试用如何运作？",
    faqA2: "您可以完全免费注册并试用 Orkest 专业版 7 天，无需绑定信用卡。试用期结束后，您可以选择订阅专业版以继续使用。否则您的账户将转入基础只读模式，并且不会产生任何费用。",
    faqQ3: "我可以在多台设备上使用 Orkest 吗？",
    faqA3: "当然可以！无论是在免费试用期还是订阅了 Orkest 专业版，您都可以在多台设备上同时登录。您的任务、日程安排和设置将会实时自动同步。",
    faqQ4: "支持哪些付款方式？",
    faqA4: "我们支持所有主流信用卡（Visa、Mastercard、American Express）、PayPal、Apple Pay 和 Google Pay（具体取决于您所在的地区和国家）。",
    securePaddle: "由 Paddle 提供支持的安全支付处理",
  },
  es: {
    backHome: "Volver a Orkest",
    title: "Precios sencillos y transparentes",
    subtitle: "Prueba Orkest gratis durante 7 días y luego actualiza tu cuenta para seguir organizando tus tareas y tiempo con las potentes funciones de IA.",
    trial: "Prueba de 7 días",
    trialPrice: "$0",
    trialPeriod: "por 7 días",
    trialDesc: "Experimenta todo el poder de Orkest antes de tomar una decisión. No se requiere tarjeta de crédito por adelantado.",
    trialBtn: "Comenzar Prueba Gratis",
    trialFeature1: "7 días de acceso Pro completo (50 mensajes de IA/día)",
    trialFeature2: "No se requiere tarjeta de crédito",
    trialFeature3: "Sincronización en todos tus dispositivos",
    pro: "Orkest Pro",
    proPrice: "$9.99",
    proPeriod: "/ mes",
    proDesc: "Desbloquea todo y organiza tus tareas y tiempo sin problemas en todos tus dispositivos.",
    proBtn: "Actualizar a Pro",
    proFeature1: "Todo lo incluido en la Prueba Gratis",
    proFeature2: "Asistente y Programación Continua con IA (200 mensajes de IA/día)",
    proFeature3: "Sesiones de enfoque y análisis ilimitados",
    proFeature4: "Sincronización avanzada sin conexión",
    proFeature5: "Recurrencia personalizada y etiquetas de prioridad",
    proFeature6: "Memoria IA que aprende tus hábitos",
    proFeature7: "Resumen diario personalizado por email",
    proFeature8: "Soporte premium y actualizaciones",
    included: "Qué está incluido",
    popular: "MÁS POPULAR",
    noCard: "Sin tarjeta de crédito por adelantado",
    autoRenew: "Facturado mensualmente, cancela en cualquier momento",
    faqTitle: "Preguntas frecuentes",
    faqQ1: "¿Puedo cancelar mi suscripción en cualquier momento?",
    faqA1: "¡Sí! Puedes cancelar tu suscripción en cualquier momento a través del portal de facturación en la configuración. Mantendrás el acceso a Orkest Pro hasta el final de tu período de facturación actual.",
    faqQ2: "¿Cómo funciona la prueba gratuita de 7 días?",
    faqA2: "Puedes registrarte y probar Orkest Pro durante 7 días completamente gratis, sin necesidad de tarjeta de crédito. Al final de la prueba, puedes optar por suscribirte a Pro para mantener activas tus funciones avanzadas. De lo contrario, tu cuenta pasará a un modo básico de solo lectura y no se realizará ningún cargo.",
    faqQ3: "¿Puedo usar Orkest en múltiples dispositivos?",
    faqA3: "¡Sí, por supuesto! Con una prueba activa o una suscripción a Orkest Pro, puedes iniciar sesión en tantos dispositivos como quieras. Tus tareas, horarios y configuraciones se sincronizarán automáticamente en tiempo real.",
    faqQ4: "¿Qué formas de pago se admiten?",
    faqA4: "Admitimos las principales tarjetas de crédito (Visa, Mastercard, American Express), PayPal, Apple Pay y Google Pay, según tu región y país.",
    securePaddle: "Procesamiento de pagos seguro impulsado por Paddle",
  },
  fr: {
    backHome: "Retour à Orkest",
    title: "Des tarifs simples et transparentes",
    subtitle: "Essayez Orkest gratuitement pendant 7 jours, puis passez à la version supérieure pour continuer à organiser vos tâches et votre temps grâce à de puissantes fonctionnalités d'IA.",
    trial: "Essai de 7 jours",
    trialPrice: "0 $",
    trialPeriod: "pendant 7 jours",
    trialDesc: "Découvrez toute la puissance d'Orkest avant de prendre votre décision. Aucune carte de crédit requise au départ.",
    trialBtn: "Commencer l'essai gratuit",
    trialFeature1: "7 jours d'accès Pro complet (50 messages d'IA/jour)",
    trialFeature2: "Aucune carte de crédit requise",
    trialFeature3: "Synchronisation sur tous vos appareils",
    pro: "Orkest Pro",
    proPrice: "9,99 $",
    proPeriod: "/ mois",
    proDesc: "Débloquez toutes les fonctionnalités et organisez vos tâches et votre temps de manière transparente sur tous vos appareils.",
    proBtn: "Passer à Pro",
    proFeature1: "Tout ce qui est inclus dans l'essai gratuit",
    proFeature2: "Planification et assistant IA en continu (200 messages d'IA/jour)",
    proFeature3: "Sessions de concentration et analyses illimitées",
    proFeature4: "Synchronisation hors ligne avancée",
    proFeature5: "Récurrence personnalisée et balises de priorité",
    proFeature6: "Mémoire IA qui apprend vos habitudes",
    proFeature7: "Résumé quotidien personnalisé par email",
    proFeature8: "Support premium et mises à jour",
    included: "Ce qui est inclus",
    popular: "LE PLUS POPULAIRE",
    noCard: "Aucune carte de crédit requise au départ",
    autoRenew: "Facturé mensuellement, annulez à tout moment",
    faqTitle: "Foire aux questions",
    faqQ1: "Puis-je annuler mon abonnement à tout moment ?",
    faqA1: "Oui ! Vous pouvez annuler votre abonnement à tout moment via le portail de facturation dans les paramètres. Vous conserverez l'accès à Orkest Pro jusqu'à la fin de votre période de facturation en cours.",
    faqQ2: "Comment fonctionne l'essai gratuit de 7 jours ?",
    faqA2: "Vous pouvez vous inscrire et essayer Orkest Pro pendant 7 jours gratuitement, sans carte de crédit. À la fin de l'essai, vous pouvez choisir de vous abonner à Pro pour conserver vos fonctionnalités avancées. Sinon, votre compte passera en mode de base en lecture seule et aucun frais ne vous sera facturé.",
    faqQ3: "Puis-je utiliser Orkest sur plusieurs appareils ?",
    faqA3: "Oui, absolument ! Avec un essai actif ou un abonnement Orkest Pro, vous pouvez vous connecter sur autant d'appareils que vous le souhaitez. Vos tâches, votre emploi du temps et vos paramètres se synchroniseront automatiquement en temps réel.",
    faqQ4: "Quels modes de paiement sont pris en charge ?",
    faqA4: "Nous prenons en charge toutes les principales cartes de crédit (Visa, Mastercard, American Express), PayPal, Apple Pay et Google Pay, selon votre région et pays.",
    securePaddle: "Traitement des paiements sécurisé par Paddle",
  },
  de: {
    backHome: "Zurück zu Orkest",
    title: "Einfache, transparente Preise",
    subtitle: "Teste Orkest 7 Tage lang kostenlos und führe dann ein Upgrade durch, um deine Aufgaben und Zeit weiterhin mit leistungsstarken KI-Funktionen zu organisieren.",
    trial: "7-tägige Testversion",
    trialPrice: "0 €",
    trialPeriod: "für 7 Tage",
    trialDesc: "Erlebe den vollen Funktionsumfang von Orkest, bevor du eine Entscheidung triffst. Keine Kreditkarte vorab erforderlich.",
    trialBtn: "Kostenlose Testversion starten",
    trialFeature1: "7 Tage voller Pro-Zugriff (50 KI-Nachrichten/Tag)",
    trialFeature2: "Keine Kreditkarte erforderlich",
    trialFeature3: "Synchronisation auf all deinen Geräten",
    pro: "Orkest Pro",
    proPrice: "9,99 €",
    proPeriod: "/ Monat",
    proDesc: "Schalte alle Funktionen frei und organisiere deine Aufgaben und Zeit nahtlos auf allen deinen Geräten.",
    proBtn: "Upgrade auf Pro",
    proFeature1: "Alles aus der kostenlosen Testversion",
    proFeature2: "Kontinuierliche KI-Planung & Assistent (200 KI-Nachrichten/Tag)",
    proFeature3: "Unbegrenzte Fokus-Sitzungen & Analysen",
    proFeature4: "Erweiterte Offline-Synchronisation",
    proFeature5: "Benutzerdefinierte Wiederholungen & Prioritätstags",
    proFeature6: "KI-Gedächtnis, das deine Gewohnheiten lernt",
    proFeature7: "Täglicher personalisierter E-Mail-Digest",
    proFeature8: "Premium-Support & Updates",
    included: "Was enthalten ist",
    popular: "SEHR BELIEBT",
    noCard: "Keine Kreditkarte vorab erforderlich",
    autoRenew: "Monatliche Abrechnung, jederzeit kündbar",
    faqTitle: "Häufig gestellte Fragen",
    faqQ1: "Kann ich mein Abonnement jederzeit kündigen?",
    faqA1: "Ja! Du kannst dein Abonnement jederzeit über das Abrechnungsportal in den Einstellungen kündigen. Du behältst den Zugriff auf Orkest Pro bis zum Ende deines aktuellen Abrechnungszeitraums.",
    faqQ2: "Wie funktioniert die 7-tägige kostenlose Testversion?",
    faqA2: "Du kannst dich anmelden und Orkest Pro 7 Tage lang völlig kostenlos testen, ohne dass eine Kreditkarte erforderlich ist. Am Ende der Testphase kannst du dich für ein Pro-Abonnement entscheiden, um deine erweiterten Funktionen aktiv zu halten. Andernfalls wechselt dein Konto in einen einfachen Nur-Lese-Modus, und es entstehen keine Kosten.",
    faqQ3: "Kann ich Orkest auf mehreren Geräten verwenden?",
    faqA3: "Ja, absolut! Mit einer aktiven Testversion oder einem Orkest Pro-Abonnement können Sie sich auf beliebig vielen Geräten anmelden. Ihre Aufgaben, Termine und Einstellungen werden automatisch in Echtzeit synchronisiert.",
    faqQ4: "Welche Zahlungsmethoden werden unterstützt?",
    faqA4: "Wir unterstützen alle gängigen Kreditkarten (Visa, Mastercard, American Express), PayPal, Apple Pay und Google Pay, je nach deiner Region und deinem Land.",
    securePaddle: "Sichere Zahlungsabwicklung durch Paddle",
  },
  ja: {
    backHome: "Orkest に戻る",
    title: "シンプルで透明な料金プラン",
    subtitle: "Orkest を 7 日間無料でお試しください。その後アップグレードすることで、強力な AI 功能を使用したタスクと時間の管理を継続できます。",
    trial: "7日間の無料トライアル",
    trialPrice: "¥0",
    trialPeriod: "7 日間利用可能",
    trialDesc: "購入前に Orkest の全機能を体験できます。クレジットカードの事前登録は不要です。",
    trialBtn: "無料トライアルを開始",
    trialFeature1: "7日間のPro機能への完全アクセス (1日50回のAIメッセージ)",
    trialFeature2: "クレジットカードの事前登録不要",
    trialFeature3: "すべてのデバイスで同期可能",
    pro: "Orkest Pro",
    proPrice: "$9.99",
    proPeriod: "/ 月",
    proDesc: "すべての機能を解放し、すべてのデバイスでタスクと時間をシームレスに管理できます。",
    proBtn: "Pro にアップグレード",
    proFeature1: "無料トライアルの全機能",
    proFeature2: "継続的なAIスケジュール＆アシスタント (1日200回のAIメッセージ)",
    proFeature3: "無制限のフォーカスセッションと分析",
    proFeature4: "高度なオフライン同期機能",
    proFeature5: "カスタム繰り返しタスクと優先度タグ",
    proFeature6: "作業習慣を学ぶAIメモリー",
    proFeature7: "毎日のパーソナライズされたメールダイジェスト",
    proFeature8: "プレミアムサポート＆優先アップデート",
    included: "含まれる機能",
    popular: "最も人気",
    noCard: "クレジットカードの事前登録不要",
    autoRenew: "月額課金、いつでもキャンセル可能",
    faqTitle: "よくある質問",
    faqQ1: "サブスクリプションはいつでもキャンセルできますか？",
    faqA1: "はい！設定内の請求ポータルからいつでもキャンセルできます。キャンセル後も、現在の請求サイクルの終了まで Orkest Pro の全機能をご利用いただけます。",
    faqQ2: "7日間の無料トライアルはどのように機能しますか？",
    faqA2: "クレジットカードを登録することなく、7 日間完全に無料で Orkest Pro をお試しいただけます。トライアル終了時に Pro サブスクリプションに登録することで、高度な機能をそのままお使いいただけます。登録しない場合、アカウントは自動的に読み取り専用のベーシックモードに移行し、費用は発生しません。",
    faqQ3: "Orkest は複数のデバイスで使用できますか？",
    faqA3: "はい、もちろん可能です！無料トライアル中または Orkest Pro のサブスクリプションをお持ちの場合、何台のデバイスでもログインできます。タスク、スケジュール、設定はリアルタイムで自動的に同期されます。",
    faqQ4: "どのような支払方法に対応していますか？",
    faqA4: "地域や国に応じて、主要なクレジットカード（Visa、Mastercard、American Express）、PayPal、Apple Pay、Google Pay に対応しています。",
    securePaddle: "Paddle が提供する安全な決済システム",
  },
  pt: {
    backHome: "Voltar para Orkest",
    title: "Preços simples e transparentes",
    subtitle: "Experimente o Orkest gratuitamente por 7 dias e, em seguida, faça o upgrade para continuar a organizar as suas tarefas e o seu tempo com recursos avançados de IA.",
    trial: "Teste de 7 dias",
    trialPrice: "$0",
    trialPeriod: "por 7 dias",
    trialDesc: "Experimente todo o poder do Orkest antes de tomar uma decisão. Nenhum cartão de crédito é exigido antecipadamente.",
    trialBtn: "Iniciar Teste Gratuito",
    trialFeature1: "7 dias de acesso Pro completo (50 mensagens de IA/dia)",
    trialFeature2: "Sem cartão de crédito antecipado",
    trialFeature3: "Sincronização em todos os seus dispositivos",
    pro: "Orkest Pro",
    proPrice: "$9.99",
    proPeriod: "/ mês",
    proDesc: "Desbloqueie tudo e organize as suas tarefas e tempo de forma integrada em todos os seus dispositivos.",
    proBtn: "Atualizar para Pro",
    proFeature1: "Tudo incluído no Teste Gratuito",
    proFeature2: "Agendamento e Assistente Contínuos com IA (200 mensagens de IA/dia)",
    proFeature3: "Sessões de foco e análises ilimitadas",
    proFeature4: "Sincronização offline avançada",
    proFeature5: "Recorrência personalizada e etiquetas de prioridade",
    proFeature6: "Memória IA que aprende os seus hábitos",
    proFeature7: "Resumo diário personalizado por email",
    proFeature8: "Suporte premium e atualizações",
    included: "O que está incluído",
    popular: "MAIS POPULAR",
    noCard: "Sem cartão de crédito antecipadamente",
    autoRenew: "Faturado mensalmente, cancele a qualquer momento",
    faqTitle: "Perguntas Frequentes",
    faqQ1: "Posso cancelar a minha subscrição a qualquer momento?",
    faqA1: "Sim! Pode cancelar a sua subscrição a qualquer momento através do portal de faturação nas configurações. Irá manter o acesso ao Orkest Pro até ao final do seu período de faturação atual.",
    faqQ2: "Como funciona o teste gratuito de 7 dias?",
    faqA2: "Pode registar-se e experimentar o Orkest Pro por 7 dias totalmente grátis, sem necessidade de cartão de crédito. No final do teste, pode optar por subscrever o Pro para manter os seus recursos avançados ativos. Caso contrário, a sua conta passará para um modo básico de apenas leitura e nenhuma cobrança será efetuada.",
    faqQ3: "Posso usar o Orkest em múltiplos dispositivos?",
    faqA3: "Sim, com certeza! Com um teste ativo ou uma assinatura do Orkest Pro, você pode fazer login em quantos dispositivos desejar. Suas tarefas, agenda e configurações serão sincronizadas automaticamente em tempo real.",
    faqQ4: "Quais formas de pagamento são aceites?",
    faqA4: "Aceitamos todos os principais cartões de crédito (Visa, Mastercard, American Express), PayPal, Apple Pay e Google Pay, dependendo da sua região e país.",
    securePaddle: "Processamento de pagamentos seguro fornecido pela Paddle",
  },
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function PricingPage({ params }: PageProps) {
  const { locale } = use(params);
  const { t } = useI18n();
  const activeLocale = (localDict[locale as Locale] ? locale : "en") as Locale;
  const d = localDict[activeLocale];

  const { user } = useAuth();
  const { appearance, setAppearance } = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [subscription, setSubscription] = useState<Record<string, unknown> | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoadingSub(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching subscription:", error);
        } else {
          setSubscription(data);
        }
      } catch (err) {
        console.error("Failed to query subscription:", err);
      } finally {
        setLoadingSub(false);
      }
    };

    fetchSubscription();
  }, [user]);

  const toggleTheme = () => {
    setAppearance(appearance === "dark" ? "light" : "dark");
  };

  const signupHref = addLocaleToPathname("/auth?mode=signup", activeLocale);
  const backHref = addLocaleToPathname("/", activeLocale);

  const isPro = subscription?.status === "active" || subscription?.status === "trialing";

  const getManageText = () => {
    switch (activeLocale) {
      case "zh-CN":
        return "当前方案 (前往设置管理)";
      case "es":
        return "Plan activo (Gestionar en ajustes)";
      case "fr":
        return "Plan actif (Gérer dans les paramètres)";
      case "de":
        return "Aktiver Plan (In den Einstellungen verwalten)";
      case "ja":
        return "現在のプラン (設定で管理)";
      case "pt":
        return "Plano ativo (Gerenciar nas configurações)";
      default:
        return "Active Plan (Manage in Settings)";
    }
  };

  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const trialEndDate = new Date(signupDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isTrialActive = !isPro && daysRemaining > 0;

  const getTrialButtonText = () => {
    if (!user) return d.trialBtn;
    if (isPro) {
      switch (activeLocale) {
        case "zh-CN":
          return "已包含在您的专业版中";
        case "es":
          return "Incluido en tu plan Pro";
        case "fr":
          return "Inclus dans votre plan Pro";
        case "de":
          return "In Ihrem Pro-Plan enthalten";
        case "ja":
          return "Proプランに含まれています";
        case "pt":
          return "Incluído no seu plano Pro";
        default:
          return "Included in your Pro plan";
      }
    }
    if (isTrialActive) {
      switch (activeLocale) {
        case "zh-CN":
          return `试用中 (剩余 ${daysRemaining} 天)`;
        case "es":
          return `Prueba activa (${daysRemaining} días)`;
        case "fr":
          return `Essai actif (${daysRemaining} jours)`;
        case "de":
          return `Testversion aktiv (${daysRemaining} Tage)`;
        case "ja":
          return `トライアル中 (残り ${daysRemaining} 日)`;
        case "pt":
          return `Teste ativo (${daysRemaining} dias)`;
        default:
          return `Trial Active (${daysRemaining} days left)`;
      }
    }
    // Trial expired
    switch (activeLocale) {
      case "zh-CN":
        return "试用已过期";
      case "es":
        return "Prueba expirada";
      case "fr":
        return "Essai expiré";
      case "de":
        return "Testversion abgelaufen";
      case "ja":
        return "トライアル終了";
      case "pt":
        return "Teste expirado";
      default:
        return "Trial Expired";
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      window.location.href = signupHref;
      return;
    }

    setUpgrading(true);
    try {
      const paddle = await getPaddle();
      if (!paddle) {
        alert("Failed to load payment system. Please try again later.");
        return;
      }

      const priceId = process.env.NEXT_PUBLIC_PADDLE_PRO_PRICE_ID || "pri_01hsxycme6m95sejkz7sbz5e9g";
      const settingsPath = addLocaleToPathname("/settings", activeLocale);
      const successUrl = `${window.location.origin}${settingsPath}`;

      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: {
          userId: user.id,
        },
        customer: {
          email: user.email || "",
        },
        settings: {
          displayMode: "overlay",
          theme: appearance === "dark" ? "dark" : "light",
          locale: activeLocale === "zh-CN" ? "zh" : activeLocale,
          successUrl,
        },
      });
    } catch (error) {
      console.error("Failed to launch checkout:", error);
      alert("Something went wrong loading payment checkout.");
    } finally {
      setUpgrading(false);
    }
  };

  const faqs = [
    { q: d.faqQ1, a: d.faqA1 },
    { q: d.faqQ2, a: d.faqA2 },
    { q: d.faqQ3, a: d.faqA3 },
    { q: d.faqQ4, a: d.faqA4 },
  ];

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#171717] transition-colors duration-300 dark:bg-[#101010] dark:text-[#f5f5f5]">
      {/* Decorative background gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,36,42,0.03)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(245,245,245,0.02)_0%,transparent_70%)]" />
        <div className="absolute top-[20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(37,36,42,0.02)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(245,245,245,0.02)_0%,transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-black/[0.04] bg-[#fcfbfa]/80 backdrop-blur-md dark:border-white/[0.04] dark:bg-[#101010]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href={backHref} className="flex items-center gap-2 text-[#25242a] hover:opacity-90 dark:text-[#f5f5f5]">
            <Logo className="h-6 w-6" />
            <span className="font-display text-base font-semibold tracking-tight">Orkest</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
                <ArrowLeft className="h-4 w-4" />
                {d.backHome}
              </Button>
            </Link>

            {mounted ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="cursor-pointer h-9 w-9 rounded-full text-[#6d6770] hover:text-[#25242a] hover:bg-[#f4f0ec]/60 dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5] dark:hover:bg-white/[0.05]"
                aria-label="Toggle theme"
              >
                {appearance === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </Button>
            ) : (
              <div className="h-9 w-9" />
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-5xl px-6 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/60 px-4 py-1.5 text-xs font-medium text-[#6d6770] shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3a3a3]">
            <Sparkles className="h-3.5 w-3.5 text-[#25242a] dark:text-[#f5f5f5]" />
            <span>Orkest Pro & Trial</span>
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl bg-gradient-to-b from-black to-neutral-300 bg-clip-text text-transparent dark:from-white dark:to-neutral-700 py-2 leading-tight sm:leading-tight mb-4">
            {d.title}
          </h1>
          <p className="text-base text-[#6d6770] dark:text-[#a3a3a3] leading-relaxed">
            {d.subtitle}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch mb-24">
          {/* Free Trial Card */}
          <div className="relative flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-[#fcfbfa]/40 p-8 shadow-sm backdrop-blur-md dark:border-white/[0.06] dark:bg-[#151515]/40 transition-all duration-300 hover:shadow-md hover:border-black/[0.1] dark:hover:border-white/[0.1]">
            <div>
              <div className="mb-6">
                <h3 className="font-display text-xl font-semibold mb-2">{d.trial}</h3>
                <p className="text-sm text-[#6d6770] dark:text-[#a3a3a3]">{d.trialDesc}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold tracking-tight">{d.trialPrice}</span>
                <span className="text-sm text-[#9ca3af]">{d.trialPeriod}</span>
              </div>

              <div className="border-t border-black/[0.04] dark:border-white/[0.04] pt-6 mb-8">
                <p className="text-xs font-semibold text-[#8b858f] dark:text-[#888888] uppercase tracking-wider mb-4">
                  {d.included}
                </p>
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[#25242a] dark:text-[#f5f5f5] shrink-0 mt-0.5" />
                    <span>{d.trialFeature1}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[#25242a] dark:text-[#f5f5f5] shrink-0 mt-0.5" />
                    <span>{d.trialFeature2}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-[#25242a] dark:text-[#f5f5f5] shrink-0 mt-0.5" />
                    <span>{d.trialFeature3}</span>
                  </li>
                </ul>
              </div>
            </div>

            {isPro ? (
              <Link href={addLocaleToPathname("/settings", activeLocale)} className="w-full block">
                <Button variant="outline" className="w-full py-6 text-sm font-medium rounded-2xl cursor-pointer opacity-60 hover:opacity-80">
                  {getTrialButtonText()}
                </Button>
              </Link>
            ) : (
              <Link href={user ? backHref : signupHref} className="w-full">
                <Button variant="outline" className="w-full py-6 text-sm font-medium rounded-2xl cursor-pointer">
                  {getTrialButtonText()}
                </Button>
              </Link>
            )}
          </div>

          {/* Pro Card (Most Popular) */}
          <div className="relative flex flex-col justify-between rounded-3xl border-2 border-[#25242a] bg-[#fcfbfa]/80 p-8 shadow-xl dark:border-[#f5f5f5] dark:bg-[#16161a]/80 transition-all duration-300 hover:scale-[1.02]">
            {/* "Most Popular" glow badge */}
            <div className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-[#25242a] px-4 py-1 text-[10px] font-bold text-white uppercase tracking-widest shadow-md dark:bg-[#f5f5f5] dark:text-[#101010]">
              {d.popular}
            </div>

            <div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-display text-xl font-bold">{d.pro}</h3>
                  <Sparkles className="h-4.5 w-4.5 text-[#25242a] dark:text-[#f5f5f5]" />
                </div>
                <p className="text-sm text-[#6d6770] dark:text-[#a3a3a3]">{d.proDesc}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-2">
                <span className="font-display text-5xl font-extrabold tracking-tight text-[#25242a] dark:text-[#f5f5f5]">{d.proPrice}</span>
                <span className="text-sm text-[#9ca3af]">{d.proPeriod}</span>
              </div>

              <div className="border-t border-black/[0.04] dark:border-white/[0.04] pt-6 mb-8">
                <p className="text-xs font-semibold text-[#8b858f] dark:text-[#888888] uppercase tracking-wider mb-4">
                  {d.included}
                </p>
                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-sm font-medium">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature1}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-medium">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature2}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm font-medium">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature3}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature4}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature5}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature6}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature7}</span>
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{d.proFeature8}</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-3 w-full">
              {user ? (
                isPro ? (
                  <Link href={addLocaleToPathname("/settings", activeLocale)} className="w-full block">
                    <Button className="w-full py-6 text-sm font-semibold rounded-2xl bg-[#25242a] hover:bg-[#1a1a1a] text-white border-none shadow-md shadow-black/20 cursor-pointer dark:bg-[#f5f5f5] dark:hover:bg-[#e0e0e0] dark:text-[#101010]">
                      {getManageText()}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    disabled={upgrading || loadingSub}
                    onClick={handleUpgrade}
                    className="w-full py-6 text-sm font-semibold rounded-2xl bg-[#25242a] hover:bg-[#1a1a1a] text-white border-none shadow-md shadow-black/20 cursor-pointer dark:bg-[#f5f5f5] dark:hover:bg-[#e0e0e0] dark:text-[#101010] flex items-center justify-center gap-2"
                  >
                    {(upgrading || loadingSub) && <RefreshCw className="h-4 w-4 animate-spin" />}
                    {d.proBtn}
                  </Button>
                )
              ) : (
                <Link href={signupHref} className="w-full block">
                  <Button className="w-full py-6 text-sm font-semibold rounded-2xl bg-[#25242a] hover:bg-[#1a1a1a] text-white border-none shadow-md shadow-black/20 cursor-pointer dark:bg-[#f5f5f5] dark:hover:bg-[#e0e0e0] dark:text-[#101010]">
                    {d.proBtn}
                  </Button>
                </Link>
              )}
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#8b858f] dark:text-[#a3a3a3]">
                <RefreshCw className="h-3 w-3 shrink-0" />
                <span>{d.autoRenew}</span>
              </div>
            </div>
          </div>
        </div>


        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto border-t border-black/[0.06] dark:border-white/[0.06] pt-20">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-center mb-12">
            {d.faqTitle}
          </h2>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-black/[0.05] bg-white/40 dark:border-white/[0.05] dark:bg-white/[0.02] overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left font-medium text-sm sm:text-base hover:bg-black/[0.02] dark:hover:bg-white/[0.01] transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4.5 w-4.5 text-[#888] shrink-0 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      isOpen ? "max-h-60 border-t border-black/[0.04] dark:border-white/[0.04]" : "max-h-0"
                    } overflow-hidden`}
                  >
                    <p className="p-5 text-xs sm:text-sm text-[#6d6770] dark:text-[#a3a3a3] leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
