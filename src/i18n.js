// pkgwatch — i18n dictionaries (zh / en)
export const messages = {
  en: {
    // header
    tagline: 'npm update email notifier',
    navHow: 'How it works',
    navLive: 'Live feed',
    // hero
    heroTitle: 'Watch it like an email address.',
    heroSub:
      'Type npm packages as tags, verify your email once, and a new release lands in your inbox the minute it ships.',
    // firehose
    liveNow: 'Live from the npm firehose',
    liveSub: 'Packages published in the last minute, straight from the registry replication feed',
    // console (subscribe form)
    consoleTitle: 'Add a watch',
    emailLabel: 'Your email',
    emailPlaceholder: 'you@company.dev',
    pkgLabel: 'Packages to watch',
    pkgPlaceholder: 'type a package, press Enter or space',
    codeLabel: 'Enter the 6-digit code',
    codePlaceholder: '000000',
    sendCode: 'Send code',
    resend: 'Resend',
    sending: 'Sending…',
    verify: 'Verify',
    verifying: 'Verifying…',
    codeSentTo: 'Code sent to {email}',
    verifiedBadge: 'Verified',
    watchBtn: 'Watch {n}',
    watchBtnOne: 'Watch {n} package',
    watchBtnPlural: 'Watch {n} packages',
    watchBtnEmpty: 'Add packages first',
    adding: 'Checking…',
    pkgHint: 'Enter or space adds a tag · Backspace removes the last one',
    dupesSkipped: '{n} already watched, skipped',
    errInvalidEmail: 'That email does not look right',
    errSendFailed: 'Could not send the code. Try again.',
    errBadCode: 'Wrong or expired code',
    errTooMany: 'Too many attempts. Request a new code.',
    errInvalidPkg: 'Invalid package name',
    errPkgNotFound: 'Package not found on npm',
    errUnverified: 'Verify your email first',
    errNetwork: 'Network error. Is the server running?',
    // your watches
    subsTitle: 'Your watches',
    subsCount: '{n} package · {email}',
    subsCountPlural: '{n} packages · {email}',
    watchedSince: 'watching since {ago}',
    unwatch: 'Stop watching',
    emptySubsTitle: 'No watches yet',
    emptySubsBody: 'Add tags above and verify your email. {example} is a good first watch.',
    // alerts
    notifTitle: 'Recent alerts',
    notifEmpty: 'Nothing yet. You will see version alerts here as they ship.',
    // close-ups board
    boardTitle: 'Every part, up close.',
    boardTag: 'Tags, not forms',
    boardTagBody: 'Packages stack like email recipients. Search suggests real names as you type.',
    boardVerify: 'One-time verify',
    boardVerifyBody: 'A 6-digit code ties your inbox to the watch list. Fifteen minutes to confirm.',
    boardAlert: 'The alert itself',
    boardAlertBody: 'Package, old version, new version. Exactly what changed, nothing else.',
    boardBatch: 'Batch by default',
    boardBatchBody: 'Add up to twenty tags in one go. Duplicates are skipped on the server.',
    boardLive: 'Registry-fed',
    boardLiveBody: 'pkgwatch reads the npm replication feed and re-checks every hit against the registry.',
    boardMail: 'Mail that arrives',
    boardMailBody: 'One email per release, sent while the version is still news.',
    // how it works
    howTitle: 'How it works.',
    how1: 'Stack tags in the console above. Search suggests package names as you type.',
    how2: 'Verify your email once with a 6-digit code.',
    how3: 'When a watched package publishes, the alert is already in your inbox.',
    // status
    statusTitle: 'Watcher',
    statusRunning: 'feed at seq {seq}',
    statusWatched: '{n} packages watched',
    statusMailConsole: 'mail: console mode',
    statusMailSmtp: 'mail: SMTP',
    // footer
    footerNote:
      'pkgwatch polls the npm registry changes feed and confirms every hit against registry.npmjs.org before it mails you.',
    footerSrc: 'Source on GitHub',
    // header controls
    themeLight: 'Switch to light theme',
    themeDark: 'Switch to dark theme',
    langToggle: '中文',
  },
  zh: {
    // header
    tagline: 'npm 包更新邮件通知',
    navHow: '工作原理',
    navLive: '实时流',
    // hero
    heroTitle: '像填邮箱一样关注包。',
    heroSub: '把 npm 包名打成标签，验证一次邮箱，新版本一发布，邮件就到收件箱。',
    // firehose
    liveNow: 'npm 发布实时流',
    liveSub: '来自 registry 复制流的最近发布记录',
    // console
    consoleTitle: '添加关注',
    emailLabel: '你的邮箱',
    emailPlaceholder: 'you@company.dev',
    pkgLabel: '要关注的包',
    pkgPlaceholder: '输入包名，回车或空格添加',
    codeLabel: '输入 6 位验证码',
    codePlaceholder: '000000',
    sendCode: '发送验证码',
    resend: '重新发送',
    sending: '发送中…',
    verify: '验证',
    verifying: '验证中…',
    codeSentTo: '验证码已发送至 {email}',
    verifiedBadge: '已验证',
    watchBtn: '关注 {n} 个',
    watchBtnOne: '关注 {n} 个包',
    watchBtnPlural: '关注 {n} 个包',
    watchBtnEmpty: '先添加包',
    adding: '查询中…',
    pkgHint: '回车或空格添加标签 · 退格删除最后一个',
    dupesSkipped: '{n} 个已在关注列表，已跳过',
    errInvalidEmail: '邮箱格式不对',
    errSendFailed: '验证码发送失败，请重试',
    errBadCode: '验证码错误或已过期',
    errTooMany: '尝试次数过多，请重新获取验证码',
    errInvalidPkg: '包名不合法',
    errPkgNotFound: 'npm 上没有这个包',
    errUnverified: '请先验证邮箱',
    errNetwork: '网络错误，服务是否已启动？',
    // your watches
    subsTitle: '我的关注',
    subsCount: '{n} 个包 · {email}',
    subsCountPlural: '{n} 个包 · {email}',
    watchedSince: '自{ago}开始关注',
    unwatch: '取消关注',
    emptySubsTitle: '还没有关注任何包',
    emptySubsBody: '在上面的控制台添加标签并验证邮箱。推荐先试试 {example}。',
    // alerts
    notifTitle: '最近通知',
    notifEmpty: '暂无通知。有新版本发布时，会出现在这里。',
    // board
    boardTitle: '每个细节，放大看。',
    boardTag: '标签，不是表单',
    boardTagBody: '包像收件人一样堆叠。输入时实时搜索真实包名。',
    boardVerify: '一次性验证',
    boardVerifyBody: '6 位验证码把邮箱和关注列表绑定，15 分钟内有效。',
    boardAlert: '通知本尊',
    boardAlertBody: '包名、旧版本、新版本，只告诉你变了什么。',
    boardBatch: '批量默认',
    boardBatchBody: '一次最多 20 个标签，重复项由服务端去重。',
    boardLive: '来自 registry',
    boardLiveBody: '读取 npm 复制流，每次命中都向 registry 复核。',
    boardMail: '真正到达的邮件',
    boardMailBody: '每次发布一封邮件，趁版本还是新闻时送达。',
    // how it works
    howTitle: '工作原理。',
    how1: '在上面的控制台堆标签，输入时实时搜索包名。',
    how2: '用 6 位验证码验证一次邮箱。',
    how3: '关注的包一发布，通知已在你的收件箱里。',
    // status
    statusTitle: '监听器',
    statusRunning: 'feed 序号 {seq}',
    statusWatched: '正在监听 {n} 个包',
    statusMailConsole: '邮件：控制台模式',
    statusMailSmtp: '邮件：SMTP',
    // footer
    footerNote: 'pkgwatch 轮询 npm registry 变更流，每次命中都会向 registry.npmjs.org 复核后再发邮件。',
    footerSrc: 'GitHub 源码',
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
