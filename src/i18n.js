// pkgwatch — i18n dictionaries (zh / en)
export const messages = {
  en: {
    tagline: 'npm update email notifier',
    heroTitle: 'New version published. You get the email.',
    heroSub:
      'Watch any npm package, verify your email once, and pkgwatch mails you the moment a new version ships. No dashboard to check, nothing to refresh.',
    liveNow: 'Live from the npm firehose',
    liveSub: 'Packages published in the last minute, straight from the registry replication feed',
    // subscribe flow
    subscribeTitle: 'Start watching a package',
    step1Label: 'Your email',
    emailPlaceholder: 'you@company.dev',
    sendCode: 'Send code',
    resend: 'Resend',
    sending: 'Sending…',
    step2Label: 'Enter the 6-digit code',
    codeSentTo: 'Code sent to {email}',
    codePlaceholder: '000000',
    verify: 'Verify',
    verifying: 'Verifying…',
    verifiedBadge: 'Verified',
    step3Label: 'Package to watch',
    pkgPlaceholder: 'e.g. @cloudflare/vite-plugin',
    addPackage: 'Watch package',
    adding: 'Checking…',
    // preview
    latestVersion: 'latest {version}',
    publishedAgo: 'published {ago}',
    pkgNotFound: 'No package with this name',
    // subscriptions
    subsTitle: 'Your watches',
    subsCount: '{n} package · {email}',
    subsCountPlural: '{n} packages · {email}',
    watchedSince: 'watching since {ago}',
    unwatch: 'Stop watching',
    emptySubsTitle: 'No watches yet',
    emptySubsBody: 'Verify your email above, then add a package. {example} is a good first watch.',
    // notifications
    notifTitle: 'Recent alerts',
    notifEmpty: 'Nothing yet — you will see version alerts here as they ship.',
    // status
    statusTitle: 'Watcher',
    statusRunning: 'feed at seq {seq}',
    statusWatched: '{n} packages watched',
    statusMailConsole: 'mail: console mode',
    statusMailSmtp: 'mail: SMTP',
    // errors
    errInvalidEmail: 'That email does not look right',
    errSendFailed: 'Could not send the code — try again',
    errBadCode: 'Wrong or expired code',
    errTooMany: 'Too many attempts — request a new code',
    errInvalidPkg: 'Invalid package name',
    errPkgNotFound: 'Package not found on npm',
    errUnverified: 'Verify your email first',
    errNetwork: 'Network error — is the server running?',
    // footer
    footerNote:
      'pkgwatch polls the npm registry changes feed and confirms every hit against registry.npmjs.org before it mails you.',
    // header controls
    themeLight: 'Switch to light theme',
    themeDark: 'Switch to dark theme',
    langToggle: '中文',
  },
  zh: {
    tagline: 'npm 包更新邮件通知',
    heroTitle: '新版本一发布，邮件马上到。',
    heroSub:
      '关注任意 npm 包，验证一次邮箱，每当有新版本发布，pkgwatch 第一时间发邮件告诉你。不用盯面板，也不用手动刷新。',
    liveNow: 'npm 发布实时流',
    liveSub: '来自 registry 复制流的最近发布记录',
    subscribeTitle: '开始关注一个包',
    step1Label: '你的邮箱',
    emailPlaceholder: 'you@company.dev',
    sendCode: '发送验证码',
    resend: '重新发送',
    sending: '发送中…',
    step2Label: '输入 6 位验证码',
    codeSentTo: '验证码已发送至 {email}',
    codePlaceholder: '000000',
    verify: '验证',
    verifying: '验证中…',
    verifiedBadge: '已验证',
    step3Label: '要关注的包名',
    pkgPlaceholder: '例如 @cloudflare/vite-plugin',
    addPackage: '关注此包',
    adding: '查询中…',
    latestVersion: '最新版 {version}',
    publishedAgo: '{ago}发布',
    pkgNotFound: '没有这个包',
    subsTitle: '我的关注',
    subsCount: '{n} 个包 · {email}',
    subsCountPlural: '{n} 个包 · {email}',
    watchedSince: '自{ago}开始关注',
    unwatch: '取消关注',
    emptySubsTitle: '还没有关注任何包',
    emptySubsBody: '先在上面的表单验证邮箱，然后添加一个包。推荐先试试 {example}。',
    notifTitle: '最近通知',
    notifEmpty: '暂无通知——有新版本发布时会出现在这里。',
    statusTitle: '监听器',
    statusRunning: 'feed 序号 {seq}',
    statusWatched: '正在监听 {n} 个包',
    statusMailConsole: '邮件：控制台模式',
    statusMailSmtp: '邮件：SMTP',
    errInvalidEmail: '邮箱格式不对',
    errSendFailed: '验证码发送失败，请重试',
    errBadCode: '验证码错误或已过期',
    errTooMany: '尝试次数过多，请重新获取验证码',
    errInvalidPkg: '包名不合法',
    errPkgNotFound: 'npm 上没有这个包',
    errUnverified: '请先验证邮箱',
    errNetwork: '网络错误——服务是否已启动？',
    footerNote:
      'pkgwatch 轮询 npm registry 变更流，每次命中都会向 registry.npmjs.org 复核后再发邮件。',
    themeLight: '切换到浅色主题',
    themeDark: '切换到深色主题',
    langToggle: 'EN',
  },
};

export function makeT(lang) {
  return (key, vars = {}) => {
    let s = messages[lang]?.[key] ?? messages.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  };
}
