# نقشه راه / TODO — Gitwe VS Code Extension

بله؛ و اتفاقاً ساختار فعلی **Gitwe** برای این کار خیلی مناسب است. بررسی فایل پروژه نشان می‌دهد که الان بخش قابل‌توجهی از قابلیت‌های `vscode-gitflow` را دارید، اما هنوز باید آن‌ها را به یک **GitFlow UI/UX کامل** تبدیل کنیم.

در پروژه فعلی شما، `start`، `finish`، `delete`، `checkout`، `pull`، `push`، graph، dashboard و مدیریت branch type وجود دارد. همچنین خود Engine عملیات `rebase`، `cherry-pick` و `stash` را هم expose کرده است.

از طرف دیگر، GitFlow استاندارد علاوه بر Start/Finish، عملیات‌هایی مثل **Publish / Pull / Track / Delete** را برای Feature/Release/Hotfix و Start برای Support تعریف می‌کند. ([GitHub][1])

### پیشنهادم: کپی‌کردن vscode-gitflow نباشد

بهتر است قابلیت‌های آن را به Gitwe اضافه کنیم، اما با معماری خود Gitwe:

```text
VS Code UI
   │
   ├── Command Palette
   ├── Activity Bar
   ├── Branch Context Menu
   ├── Dashboard
   └── Status Bar
          │
          ▼
   Gitwe VSCode Adapter
          │
          ▼
      Gitwe Engine
          │
    ┌─────┴─────┐
    ▼           ▼
 Workflow      Git
 Rules         Operations
```

این با اصل فعلی پروژه هم سازگار است: Extension باید UI باشد و منطق عملیات در Engine بماند. خود README فعلی نیز همین معماری را صریحاً بیان کرده است.

## قابلیت‌هایی که اضافه می‌کنیم

### 1. Feature

```text
Gitwe: Feature
 ├── Start
 ├── Finish
 ├── Publish
 ├── Pull
 ├── Track
 ├── Delete
 └── Checkout
```

### 2. Release

```text
Gitwe: Release
 ├── Start
 ├── Finish
 ├── Publish
 ├── Pull
 ├── Track
 └── Delete
```

### 3. Hotfix

```text
Gitwe: Hotfix
 ├── Start
 ├── Finish
 ├── Publish
 ├── Pull
 ├── Track
 └── Delete
```

### 4. Support

```text
Gitwe: Support
 ├── Start
 ├── Checkout
 └── Delete
```

Support در git-flow معمولاً از production/master ایجاد می‌شود و برخلاف feature/release/hotfix الزاماً Finish معمولی ندارد. ([GitHub][1])

---

# مهم‌ترین تفاوت با نسخه فعلی

الان شما Commandهای عمومی دارید:

```text
Gitwe: Start Branch...
Gitwe: Finish Branch...
Gitwe: Delete Branch...
Gitwe: Checkout Branch
Gitwe: Pull
Gitwe: Push
```

که در `package.json` هم تعریف شده‌اند.

من پیشنهاد می‌کنم علاوه بر آن‌ها، Commandهای **context-aware** اضافه کنیم:

```text
Gitwe: Start Feature...
Gitwe: Finish Feature
Gitwe: Publish Feature
Gitwe: Pull Feature
Gitwe: Track Feature
Gitwe: Delete Feature

Gitwe: Start Release...
Gitwe: Finish Release
Gitwe: Publish Release
Gitwe: Pull Release
Gitwe: Track Release
Gitwe: Delete Release

Gitwe: Start Hotfix...
Gitwe: Finish Hotfix
Gitwe: Publish Hotfix
Gitwe: Pull Hotfix
Gitwe: Track Hotfix
Gitwe: Delete Hotfix

Gitwe: Start Support...
Gitwe: Delete Support
```

اما **منطق این Commandها نباید در VS Code نوشته شود**.

---

# معماری پیشنهادی Engine

در `gitwe-ts` بهتر است abstraction به این شکل باشد:

```ts
interface BranchWorkflowService {
  list(type: BranchType): Promise<BranchStatus[]>;

  start(
    type: BranchType,
    name: string,
    options?: StartOptions,
  ): Promise<StartResult>;

  finish(
    branch: ResolvedBranch,
    options?: FinishOptions,
  ): Promise<FinishResult>;

  delete(
    branch: ResolvedBranch,
    options?: DeleteOptions,
  ): Promise<DeleteResult>;

  publish(
    branch: ResolvedBranch,
    options?: PublishOptions,
  ): Promise<PublishResult>;

  pull(branch: ResolvedBranch, options?: PullOptions): Promise<PullResult>;

  track(
    type: BranchType,
    name: string,
    options?: TrackOptions,
  ): Promise<TrackResult>;
}
```

بعد:

```text
FeatureWorkflow
ReleaseWorkflow
HotfixWorkflow
SupportWorkflow
```

ولی حتی بهتر از آن، چون Gitwe از ابتدا workflow-based است، **نباید کلاس‌های FeatureWorkflow/ReleaseWorkflow را hard-code کنیم**.

یعنی:

```text
BranchType
   │
   ├── name
   ├── aliases
   ├── base
   ├── target
   ├── prefix
   └── capabilities
```

مثلاً:

```yaml
branchTypes:
  - name: feature
    prefix: feature/
    base: develop
    target: develop

    capabilities:
      start: true
      finish: true
      publish: true
      pull: true
      track: true
      delete: true
```

این خیلی مهم است، چون Gitwe فعلی فقط GitFlow نیست؛ presetهای `classic`، `github` و `gitlab` دارد.

---

# قابلیت‌های Branch

من حتی پیشنهاد می‌کنم یک مفهوم مرکزی به Engine اضافه کنیم:

```ts
type BranchCapability =
  | "start"
  | "finish"
  | "publish"
  | "pull"
  | "track"
  | "delete"
  | "checkout"
  | "merge"
  | "rebase"
  | "tag";
```

و:

```ts
interface BranchCapabilities {
  start: boolean;
  finish: boolean;
  publish: boolean;
  pull: boolean;
  track: boolean;
  delete: boolean;
  checkout: boolean;
  merge: boolean;
  rebase: boolean;
  tag: boolean;
}
```

آن‌وقت UI خودش از Workflow می‌فهمد چه کاری مجاز است.

---

# UI جدید

در Sidebar فعلی شما branch type به صورت group نمایش داده می‌شود.

آن را تبدیل می‌کنیم به:

```text
GITWE
│
├── MAIN
│
├── DEVELOP
│
├── FEATURE
│   ├── feature/login
│   ├── feature/payment
│   └── feature/dashboard
│
├── RELEASE
│   └── release/1.4.0
│
├── HOTFIX
│   └── hotfix/1.3.1
│
└── SUPPORT
    └── support/1.0
```

و روی هر branch:

```text
Right Click
│
├── Checkout
├── Finish
├── Publish
├── Pull
├── Track
├── Delete
├── Rebase
├── Merge
└── Open Graph
```

البته فقط capabilityهای مجاز نمایش داده شوند.

VS Code برای همین نوع context menuها `view/item/context` و `when` clause دارد، بنابراین این UI کاملاً با مکانیزم native VS Code قابل پیاده‌سازی است. ([GitHub][2])

---

# Dashboard

Dashboard فعلی شما همین الان پایه خوبی دارد؛ داده‌هایی مثل workflow، current branch، working tree، base branches، branch types و health را نمایش می‌دهد.

آن را به چیزی شبیه این تبدیل کنیم:

```text
┌───────────────────────────────────────────────┐
│ Gitwe                         classic workflow │
├───────────────────────────────────────────────┤
│                                               │
│ Current                                       │
│ feature/payment                               │
│                                               │
│ ● Working tree clean                          │
│                                               │
├───────────────────────────────────────────────┤
│ FEATURES                                      │
│                                               │
│ feature/payment       [Finish] [Publish]      │
│ feature/login         [Checkout] [Delete]     │
│                                               │
├───────────────────────────────────────────────┤
│ RELEASES                                      │
│                                               │
│ release/1.4.0         [Finish] [Publish]      │
│                                               │
├───────────────────────────────────────────────┤
│ HOTFIXES                                      │
│                                               │
│ hotfix/1.3.1          [Finish] [Publish]      │
│                                               │
├───────────────────────────────────────────────┤
│ QUICK ACTIONS                                 │
│                                               │
│ [+ Feature] [+ Release] [+ Hotfix]            │
│ [Pull] [Push] [Refresh] [Graph]               │
└───────────────────────────────────────────────┘
```

Dashboard فعلی نیز mutationها را به Commandهای VS Code delegate می‌کند، بنابراین همین الگو را حفظ می‌کنیم و منطق Git را وارد WebView نمی‌کنیم.

---

# یک قابلیت مهم‌تر: Remote Branch Management

این قسمت به نظرم برای Gitwe بسیار مهم است.

مثلاً:

```text
FEATURE
│
├── Local
│   └── feature/login
│
└── Remote
    ├── origin/feature/payment
    └── origin/feature/profile
```

و برای remote branch:

```text
Track
Checkout
Pull
Delete Remote
```

این دقیقاً یکی از قابلیت‌های GitFlow استاندارد است؛ `publish` و `track` برای share کردن feature/release/hotfix branchها تعریف شده‌اند. ([GitHub][3])

---

# همچنین باید Finish را حرفه‌ای‌تر کنیم

نسخه فعلی شما هنگام Finish فقط چند option می‌گیرد:

```text
Delete after finish?
Push to remote?
```

و سپس:

```ts
client.finishBranch(branchName, deleteAfter, push);
```

ما باید آن را به Workflow-aware Finish تبدیل کنیم:

```text
Finish release/1.4.0

Target branches:
 ☑ main
 ☑ develop

Merge strategy:
 ○ merge
 ○ no-ff
 ○ squash

Create tag:
 ☑ yes

Tag:
 v1.4.0

Push:
 ☑ main
 ☑ develop
 ☑ tag

Delete local:
 ☑

Delete remote:
 ☑

             [Cancel] [Finish]
```

این با معماری فعلی Versioning شما هم بسیار خوب جور درمی‌آید، چون Gitwe الان tag/version bump را در Engine انجام می‌دهد و نتیجه Finish هم tag را برمی‌گرداند. در extension فعلی نیز `result.tag` مصرف می‌شود.

---

# در نتیجه Roadmap من این است

### Phase 1 — GitFlow parity

```text
Start
Finish
Delete
Publish
Pull
Track

Feature
Release
Hotfix
Support
```

### Phase 2 — UI

```text
Branch Context Menu
Type Context Menu
Remote Branches
Quick Actions
Dashboard Actions
```

### Phase 3 — Advanced GitFlow

```text
Base selection
Target selection
Merge strategy
Squash
No-FF
Tag
Version bump
Changelog
Push
Remote delete
```

### Phase 4 — Workflow Engine

```text
BranchCapabilities
WorkflowPolicies
OperationPreconditions
OperationPlan
OperationResult
```

مثلاً:

```ts
const plan = workflow.plan("finish", branch);

for (const step of plan.steps) {
  await step.execute(context);
}
```

که با کاری که اخیراً روی **Workflow-based implementation** و Stepهای `Preflight → Fetch → Rebase → Merge → VersionBump → Tag → Push → Delete...` انجام داده‌ایم، کاملاً هم‌راستا است.

### Phase 5 — تجربه‌ای فراتر از vscode-gitflow

در نهایت Gitwe فقط یک GitFlow UI نباشد:

```text
                   Gitwe
                     │
          ┌──────────┼──────────┐
          │          │          │
       Classic    GitHub     GitLab
       GitFlow     Flow       Flow
          │
     Custom Workflow
          │
     ┌────┴────┐
     │         │
 Branches   Policies
     │         │
     └────┬────┘
          │
      Workflow Engine
```

این همان جایی است که Gitwe می‌تواند از `vscode-gitflow` جلو بزند: **vscode-gitflow را به عنوان UX مرجع می‌گیریم، نه معماری.**

اگر موافقی، قدم بعدی را از **Phase 1** شروع کنیم و دقیقاً `Publish / Pull / Track / Delete` را به Engine و بعد VS Code اضافه کنیم؛ اول interfaceها و مدل‌های domain، بعد handlerها، بعد commandها و در آخر Sidebar/Dashboard.

[1]: https://github.com/nvie/gitflow?utm_source=chatgpt.com "GitHub - nvie/gitflow: Git extensions to provide high-level repository operations for Vincent Driessen's branching model. · GitHub"
[2]: https://github.com/microsoft/vscode-docs/blob/main/api/references/contribution-points.md?utm_source=chatgpt.com "vscode-docs/api/references/contribution-points.md at main · microsoft/vscode-docs · GitHub"
[3]: https://github.com/petervanderdoes/gitflow-avh?utm_source=chatgpt.com "GitHub - petervanderdoes/gitflow-avh: AVH Edition of the git extensions to provide high-level repository operations for Vincent Driessen's branching model · GitHub"

---

قابلیت‌هایی که پیشنهاد می‌کنم اضافه شوند (اولویت‌بندی)
فاز ۱ — اولویت بالا (نزدیک‌ترین به تجربهٔ vscode-gitflow)

Rebase branch روی base
Publish branch (push + -u)
Track remote branch
Quick Pick منو با کلید میانبر (مثلاً Shift+Alt+G یا مشابه)
Checkout base branches (main / develop / …)
Fetch و Sync root branches

فاز ۲

مدیریت Tag (لیست، push، delete local/remote)
دستور Init داخل اکستنشن (نوشتن .gitwe/gitwe.yaml یا preset)
بهبود Status Bar + منوی contextual روی branch فعلی

فاز ۳ (اختیاری / پیشرفته)

Auto-bump package.json هنگام start/finish release/hotfix (علاوه بر versioning خود gitwe)
Auto-update CHANGELOG.md
View جدا در SCM برای Versions/Tags
