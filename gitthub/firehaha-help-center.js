// @firehaha-plugin {"id":"official.help-center","name":"標籤與插件教學中心","version":"1.1.3","author":"Firehaha","description":"提供完整標籤、RPG 模組、媒體插件、編輯器工具與快捷鍵教學，支援搜尋、複製與插入正文。"}

FirehahaPlugins.register({
  id: "official.help-center",
  name: "標籤與插件教學中心",
  version: "1.1.3",

  setup(api) {
    "use strict";

    const tri = (zh, en, ja) => ({ "zh-TW": zh, en, ja });
    const ex = (code, place) => ({ code, place: place || "content" });

    const categoryLabels = {
      all: tri("全部教學", "All guides", "すべて"),
      start: tri("快速開始", "Quick start", "クイックスタート"),
      rpg: tri("RPG 模組", "RPG modules", "RPGモジュール"),
      media: tri("媒體與閱讀器", "Media & reader", "メディア・リーダー"),
      editor: tri("編輯器工具", "Editor tools", "エディターツール"),
      core: tri("效能與核心", "Performance & core", "性能・コア"),
      dev: tri("開發與診斷", "Development & diagnostics", "開発・診断"),
      shortcuts: tri("快捷鍵", "Keyboard shortcuts", "ショートカット")
    };

    const placeLabels = {
      content: tri("Node 內文", "Node content", "Node本文"),
      choice: tri("選項文字", "Choice text", "選択肢テキスト"),
      ui: tri("編輯器介面", "Editor interface", "エディター画面"),
      automatic: tri("自動運作", "Automatic", "自動動作")
    };

    const entries = [
      {
        id: "core.gamebook-tags", category: "start", place: "content",
        title: tri("Gamebook 原生冒險標籤", "Built-in Gamebook adventure tags", "Gamebook標準冒険タグ"),
        summary: tri("狀態標籤放在 Node 內文，讀者進入頁面時執行；以 [隱藏:…] 開頭的條件只放在選項文字，控制該選項是否出現。名稱、空格與大小寫必須前後一致。", "Put state tags in node content; they run when the reader enters the page. Put [隱藏:…] only at the start of choice text to control that choice. Names must match exactly.", "状態タグはNode本文に置き、ページ表示時に実行されます。[隱藏:…] は選択肢の先頭に置き、その選択肢だけを制御します。名前は完全一致が必要です。"),
        examples: [
          ex("[取得:銀色鑰匙]"), ex("[失去:銀色鑰匙]"), ex("[旗幟:見過守門人]"), ex("[取消旗幟:見過守門人]"),
          ex("[數值:體力=10]"), ex("[增加:金錢:5]"), ex("[減少:體力:2]"), ex("[屬性:力量=14]"), ex("[修正值:力量=2]"),
          ex("[技能:開鎖=60]"), ex("[技能修正值:開鎖=5]"), ex("[任務:尋找公主:進行中]"), ex("[骰子:1d20:力量]"),
          ex("[檢定:開鎖:1d100:<=:技能:開鎖]"), ex("[檢定等級:攻擊:大成功:自然骰=20]"), ex("[傷害骰:長劍:1d8+3]"),
          ex("[重擊:長劍:攻擊=大成功:骰數加倍]"), ex("[成功骰:駭入:5d6:>=5:2]"), ex("[noback]"), ex("[nosave]"), ex("[savepoint:進入古堡]"),
          ex("[隱藏:持有:銀色鑰匙]打開大門", "choice"), ex("[隱藏:數值:體力>=5]推開石門", "choice"), ex("[隱藏:檢定:開鎖=成功]進入密室", "choice")
        ]
      },
      {
        id: "official.if-block", category: "rpg", place: "content",
        title: tri("如果條件區塊", "Conditional content blocks", "条件分岐ブロック"),
        summary: tri("在同一頁正文中依冒險狀態顯示不同段落。條件和 [隱藏:…] 相同，支援持有、旗幟、數值、屬性、技能、任務與檢定；每個 [如果] 都必須有 [/如果]。", "Show different passages on one page using the same conditions as [隱藏:…]. Supports items, flags, values, attributes, skills, quests and checks. Every [如果] needs a closing [/如果].", "[隱藏:…] と同じ条件で、同じページ内の本文を切り替えます。各 [如果] には必ず [/如果] が必要です。"),
        examples: [ex("[如果:持有:古老鑰匙]\n門鎖發出微光。\n[否則]\n門仍然鎖著。\n[/如果]"), ex("[如果:數值:HP<=0]你倒下了。[/如果]")]
      },
      {
        id: "official.auto-jump", category: "rpg", place: "content",
        title: tri("自動跳轉", "Automatic page jump", "自動ページ移動"),
        summary: tri("進入頁面後自動前往指定頁碼，可加上毫秒延遲或冒險條件。同頁多條規則由上到下判斷，第一條成立的規則生效。", "Jump to a page on entry, optionally after a delay or only when a condition passes. Rules are checked top to bottom and the first match wins.", "ページ表示後に指定ページへ移動します。遅延や条件を追加でき、上から最初に成立した規則が使われます。"),
        examples: [ex("[自動跳轉:7]"), ex("[自動跳轉:7:1500]"), ex("[自動跳轉:旗幟:拿到鑰匙:7]"), ex("[自動跳轉:數值:HP<=0:12:1500]")]
      },
      {
        id: "official.name-variable", category: "rpg", place: "content",
        title: tri("名稱變數", "Name variables", "名前変数"),
        summary: tri("儲存玩家或角色名稱，建立輸入框，並在後續正文顯示。冒號後可依序設定提示、預設名稱與按鈕文字。", "Store player or character names, render an input box, and display the saved value later. Optional fields set placeholder, fallback name and button label.", "プレイヤー名やキャラクター名を保存し、入力欄と後続本文での表示を提供します。"),
        examples: [ex("[名稱:主角=艾莉亞]"), ex("[名字輸入:玩家名稱:請輸入名字:無名旅人:確認]"), ex("{名稱:玩家名稱:無名旅人}"), ex("{顯示:名稱:玩家名稱::無名旅人}"), ex("[清除名稱:玩家名稱]")]
      },
      {
        id: "official.name-variable-plus", category: "rpg", place: "content",
        title: tri("名稱變數補充與跳頁", "Name input and jump", "名前入力とページ移動"),
        summary: tri("輸入或選擇預設名稱後立即跳到指定頁碼。頁碼以作品頁面順序從 1 開始。", "Jump to a target page immediately after entering or choosing a name. Page numbers use the story order starting from 1.", "名前を入力または選択した後、指定ページへ移動します。ページ番号は1から始まります。"),
        examples: [ex("[名字輸入跳頁:玩家名稱:請替角色取名:無名旅人:確認名字:5]"), ex("[預設名稱:玩家名稱=阿爾斯:使用阿爾斯:5]")]
      },
      {
        id: "official.draggable-text", category: "rpg", place: "content",
        title: tri("拖曳文字與拖曳跳轉", "Draggable text and drag-to-jump", "ドラッグ文字と移動"),
        summary: tri("把文字做成可用滑鼠、觸控或觸控筆拖曳的元件；新版可建立目標區，拖入後跳到指定頁碼。第一欄是識別名稱，第二欄是顯示文字。", "Create text that can be dragged with mouse, touch or pen. The current version can create a drop target that jumps to a page. The first field is the identifier and the second is visible text.", "マウス・タッチ・ペンで動かせる文字を作成します。ドロップ先へ入れると指定ページへ移動できます。"),
        examples: [ex("[拖曳文字:鑰匙|拖曳這把鑰匙]"), ex("[拖曳跳轉:鑰匙|拖到門上|5]")]
      },
      {
        id: "official.dice-auto-if-reader-hook", category: "rpg", place: "content",
        title: tri("自動骰與骰子條件", "Automatic dice and dice conditions", "自動ダイスと条件"),
        summary: tri(
          "頁面顯示時自動擲 D4、D6、D20 或 D100，可加減固定值並命名結果。骰子條件建議優先使用文字比較規則，避免 >=、<= 等符號在多個骰子插件同時解析時產生衝突。支援：至少／至多／超過／未滿／等於／不等於；舊版 >=、<=、>、<、=、!= 仍保留相容。",
          "Automatically roll D4, D6, D20 or D100 when the page opens, with an optional modifier and result name. For dice conditions, text comparison rules are recommended to avoid parser conflicts with symbols such as >= and <= when multiple dice plugins are active. Supported rules: at least, at most, greater than, less than, equal to, and not equal to. Legacy >=, <=, >, <, = and != syntax remains compatible.",
          "ページ表示時に D4／D6／D20／D100 を自動で振り、固定修正値と結果名を設定できます。複数のダイスプラグインによる >=、<= などの記号解析の競合を避けるため、条件には文字による比較規則を推奨します。対応：以上／以下／より大きい／未満／等しい／等しくない。従来の >=、<=、>、<、=、!= も互換用として使用できます。"
        ),
        examples: [
          ex("[自動骰:d20+2|陷阱]"),
          ex("[如果:自動骰:陷阱|至少|15]\n成功避開陷阱\n[否則]\n踩中了陷阱\n[/如果]"),
          ex("[如果:自動骰:敵人|至多|9]\n敵人的攻擊落空。\n[否則]\n敵人的攻擊命中。\n[/如果]"),
          ex("[如果:自動骰:敵人|超過|10]敵人的攻擊命中。[/如果]"),
          ex("[如果:自動骰:敵人|未滿|10]敵人的攻擊落空。[/如果]"),
          ex("[如果:自動骰:敵人|等於|20]自然骰達到指定值。[/如果]"),
          ex("[如果:自動骰:敵人|不等於|1]結果不是 1。[/如果]"),

          ex("[如果:自動骰:Trap|at least|15]\nYou avoid the trap.\n[否則]\nYou trigger the trap.\n[/如果]"),
          ex("[如果:自動骰:Enemy|at most|9]The attack misses.[/如果]"),
          ex("[如果:自動骰:Enemy|greater than|10]The attack hits.[/如果]"),
          ex("[如果:自動骰:Enemy|less than|10]The attack misses.[/如果]"),
          ex("[如果:自動骰:Enemy|equal to|20]The result is exactly 20.[/如果]"),
          ex("[如果:自動骰:Enemy|not equal to|1]The result is not 1.[/如果]"),

          ex("[如果:自動骰:罠|以上|15]\n罠を回避した。\n[否則]\n罠にかかった。\n[/如果]"),
          ex("[如果:自動骰:敵|以下|9]攻撃は外れた。[/如果]"),
          ex("[如果:自動骰:敵|より大きい|10]攻撃が命中した。[/如果]"),
          ex("[如果:自動骰:敵|未満|10]攻撃は外れた。[/如果]"),
          ex("[如果:自動骰:敵|等しい|20]結果はちょうど20。[/如果]"),
          ex("[如果:自動骰:敵|等しくない|1]結果は1ではない。[/如果]"),

          ex("[如果:自動骰:陷阱>=15]舊版符號語法：成功[否則]失敗[/如果]"),
          ex("[如果:骰子:力量>=18]原生骰舊版符號條件[/如果]")
        ]
      },
      {
        id: "official.opposed-dice-engine-v1-1", category: "rpg", place: "content",
        title: tri("通用對抗骰", "Opposed dice engine", "対抗ダイス"),
        summary: tri("比較兩個已存在的骰子、檢定、傷害骰、成功骰、自動骰、命運骰或固定值。可選高者勝、低者勝、接近指定值者勝及平手規則。先產生兩側結果，再執行對抗標籤。", "Compare two existing dice, check, damage, pool, auto-die, Fate-die or fixed results. Supports high wins, low wins, closest-to-target and tie rules. Generate both source results before the opposed tag runs.", "既存のダイス、判定、ダメージ、自動ダイス、固定値などを比較します。両側の結果を先に作成してください。"),
        examples: [ex("[對抗骰:決鬥|骰子:力量|自動骰:敵人]"), ex("[對抗骰:潛行|骰子:敏捷|檢定:守衛察覺|高者勝|平手]"), ex("[對抗骰:恐怖檢定|骰子:意志|固定:30|低者勝|平手]"), ex("[如果:對抗:決鬥=左勝]你贏得決鬥[否則]你落敗[/如果]"), ex("[如果:對抗差值:決鬥>=5]這是一場壓倒性勝利[/如果]")]
      },
      {
        id: "official.persistent-opposed-if-bridge-v1-1", category: "rpg", place: "content",
        title: tri("持續對抗條件橋接", "Persistent opposed-condition bridge", "持続対抗条件ブリッジ"),
        summary: tri("當閱讀器把 [如果]、[否則] 與 [/如果] 拆成不同文字節點時，仍能正確判定已保存的對抗結果。優先使用持續保存版對抗資料，未安裝時會相容內建通用對抗骰；請先產生同名對抗結果。", "Evaluates saved opposed results even when the reader splits if/else tags across text nodes. It prefers the persistent provider and falls back to the built-in opposed-dice engine. Generate the named opposed result first.", "リーダーが条件タグを複数テキストノードへ分割しても、保存済み対抗結果を判定します。先に同名の対抗結果を作成してください。"),
        examples: [ex("[如果:持續對抗:決鬥=左勝]\n你延續先前的勝勢。\n[否則]\n對手仍占上風。\n[/如果]"), ex("[如果:持續對抗差值:決鬥>=5]這是壓倒性的結果。[/如果]")]
      },
      {
        id: "official.auto-dice-jump", category: "rpg", place: "content",
        title: tri("自動擲骰跳轉", "Auto-roll and jump", "自動ロール移動"),
        summary: tri("自動點擊原生骰子或原生檢定，等待結果後依條件前往成功／失敗頁。頁碼填「-」代表該結果不跳轉，最後一欄是等待毫秒。", "Automatically roll a built-in die or check, wait for the result, then jump to success or failure pages. Use - for no jump; the last field is delay in milliseconds.", "標準ダイスや判定を自動実行し、結果に応じて成功／失敗ページへ移動します。"),
        examples: [ex("[自動骰跳轉:1d20|屬性:力量|>=|15|7|8|1200]"), ex("[自動檢定跳轉:開鎖|1d100|<=|技能:開鎖|7|8|1200]")]
      },
      {
        id: "official.number-display", category: "rpg", place: "content",
        title: tri("數值文字顯示", "Value display", "数値表示"),
        summary: tri("把目前冒險數值直接插入正文；尚未建立的數值顯示 0。", "Insert the current adventure value into story text. Missing values display as 0.", "現在の冒険数値を本文へ表示します。未設定は0です。"),
        examples: [ex("目前體力：{數值:體力}")]
      },
      {
        id: "official.item-display", category: "rpg", place: "content",
        title: tri("物品文字顯示", "Item display", "アイテム表示"),
        summary: tri("在正文顯示是否持有指定物品，或輸出目前物品清單。", "Show whether an item is owned or print the current inventory in story text.", "指定アイテムの所持状態または所持品一覧を表示します。"),
        examples: [ex("鑰匙狀態：{物品:銀色鑰匙}"), ex("{顯示:物品:銀色鑰匙:是否持有:未持有}")]
      },
      {
        id: "official.attribute-display", category: "rpg", place: "content",
        title: tri("屬性文字顯示", "Attribute display", "能力値表示"),
        summary: tri("在正文顯示指定屬性的基礎值。", "Display the base value of an attribute in story text.", "指定能力値の基本値を本文へ表示します。"),
        examples: [ex("力量：{屬性:力量}")]
      },
      {
        id: "official.skill-display", category: "rpg", place: "content",
        title: tri("技能文字顯示", "Skill display", "技能表示"),
        summary: tri("在正文顯示指定技能的基礎值。", "Display the base value of a skill in story text.", "指定技能の基本値を本文へ表示します。"),
        examples: [ex("開鎖：{技能:開鎖}")]
      },
      {
        id: "official.attribute-list-display", category: "rpg", place: "content",
        title: tri("屬性列表顯示", "Attribute list", "能力値一覧"),
        summary: tri("列出所有已建立屬性。冒號後可自訂每組資料之間的分隔文字。", "List all defined attributes. Text after the colon customizes the separator between pairs.", "登録済み能力値を一覧表示します。コロンの後で区切り文字を指定できます。"),
        examples: [ex("{屬性列表}"), ex("{屬性列表:｜}")]
      },
      {
        id: "official.skill-list-display", category: "rpg", place: "content",
        title: tri("技能列表顯示", "Skill list", "技能一覧"),
        summary: tri("列出所有已建立技能。冒號後可自訂分隔文字。", "List all defined skills, optionally using a custom separator.", "登録済み技能を一覧表示します。"),
        examples: [ex("{技能列表}"), ex("{技能列表:／}")]
      },
      {
        id: "official.final-value-display", category: "rpg", place: "content",
        title: tri("屬性／技能最終值", "Final attribute and skill values", "能力・技能の最終値"),
        summary: tri("顯示基礎值加修正值後的最終結果，也能一次列出全部最終值。", "Display base plus modifier, or list every final attribute or skill value.", "基本値と修正値を合計した最終値、または一覧を表示します。"),
        examples: [ex("最終力量：{屬性最終:力量}"), ex("最終開鎖：{技能最終:開鎖}"), ex("{屬性最終列表:｜}"), ex("{技能最終列表:｜}")]
      },
      {
        id: "official.attribute-skill-native-fix", category: "rpg", place: "automatic",
        title: tri("屬性／技能原生修正", "Native attribute and skill fix", "能力・技能の標準修正"),
        summary: tri("自動修正返回上一頁時屬性／技能被錯誤回溯，以及作者修改初始值後舊定義未更新的問題。仍使用原生 [屬性]、[修正值]、[技能] 與 [技能修正值] 標籤，不需要額外語法。", "Automatically fixes attribute and skill rollback on Back and refreshes changed definitions. Continue using the built-in attribute and skill tags; no extra syntax is required.", "戻る操作で能力・技能が誤って巻き戻る問題を自動修正します。追加タグは不要です。"),
        examples: [ex("[屬性:力量=12]\n[修正值:力量=2]\n[技能:開鎖=60]\n[技能修正值:開鎖=5]")]
      },
      {
        id: "official.create-tag", category: "rpg", place: "content",
        title: tri("建立自訂短標籤", "Create custom shorthand tags", "独自短縮タグ"),
        summary: tri("把較長的顯示標籤定義成簡短名稱，再用 {短名} 引用。可用單行或區塊批次定義；別名不可包含括號、中括號或等號。", "Define a short alias for a longer display expression, then reference it as {alias}. Supports one-line and block definitions.", "長い表示タグに短い別名を付け、{別名} で参照します。1行またはブロックで定義できます。"),
        examples: [ex("[建立標籤:HP={顯示:數值:體力::0}]\n目前 HP：{HP}"), ex("[建立標籤]\n力量值={顯示:屬性:力量::0}\n開鎖值={顯示:技能:開鎖::0}\n[/建立標籤]"), ex("[移除標籤:HP]"), ex("[清除建立標籤]")]
      },
      {
        id: "official.display-tag", category: "rpg", place: "content",
        title: tri("統一文字顯示標籤", "Unified display tag", "統一表示タグ"),
        summary: tri("統一格式為 {顯示:類型:名稱:格式:找不到時的文字}。類型支援數值、物品、旗幟、屬性、技能、任務、骰子、檢定、傷害與成功骰。格式欄可留空。", "Use {顯示:type:name:format:fallback}. Supported types include values, items, flags, attributes, skills, quests, dice, checks, damage and success pools. Format may be empty.", "形式は {顯示:種類:名前:形式:未検出時の文字}。数値、アイテム、能力、技能、判定などに対応します。"),
        examples: [ex("{顯示:數值:體力::0}"), ex("{顯示:物品:藥水:數量:0}"), ex("{顯示:旗幟:擊敗魔王:布林:false}"), ex("{顯示:檢定:開鎖:結果:尚未檢定}"), ex("{顯示:傷害:長劍:總值:0}")]
      },

      {
        id: "official.native-asset-reader-adapter", category: "media", place: "ui",
        title: tri("原生素材庫與閱讀器封裝", "Native asset library and reader packaging", "素材ライブラリとリーダー同梱"),
        summary: tri("從素材庫匯入圖片並插入目前正文或 HTML；測試閱讀與輸出時會把 IndexedDB 素材封裝進閱讀器。範例：在素材庫選取圖片後使用「插入正文」或拖到編輯區。", "Import images through the asset library and insert or drag them into the current editor. Reader preview and export package IndexedDB assets automatically.", "素材庫から画像を読み込み、本文やHTMLへ挿入します。プレビューと出力時に自動同梱されます。")
      },
      {
        id: "official.native-audio-adapter", category: "media", place: "content",
        title: tri("原生音訊素材", "Native audio assets", "音声素材"),
        summary: tri("先在素材庫匯入音訊，再由素材卡插入播放、停止或播放後跳頁標籤。按「重新開始」會停止全部音樂、取消淡出與待執行跳頁、將進度與音量還原，並重置播放器按鈕。", "Import audio, then insert play, stop or play-and-jump tags from its asset card. Restart stops every track, cancels fades and pending jumps, rewinds playback, restores volume, and resets player buttons.", "素材カードから再生・停止・移動タグを挿入します。最初から開始すると、全音声、フェード、待機中の移動を停止し、再生位置・音量・ボタンを初期化します。"),
        examples: [ex("[bgmplay:音訊ID|播放音樂]"), ex("[bgmstop:音訊ID|停止音樂]"), ex("[bgmjump:音訊ID|3|播放並前往第 3 頁]"), ex("[bgmfadeout]"), ex("[bgmoff]")]
      },
      {
        id: "official.native-video-adapter", category: "media", place: "content",
        title: tri("原生影片素材", "Native video assets", "動画素材"),
        summary: tri("從素材庫插入影片播放、播放後跳頁、過場動畫或靜音背景影片。按「重新開始」會關閉影片與背景影片、歸零播放進度、取消淡出與播放完成跳頁，並重置影片按鈕。", "Insert video playback, play-and-jump, cutscenes or muted backgrounds. Restart closes foreground and background videos, rewinds them, cancels fades and ended-navigation, and resets video buttons.", "動画再生、移動、カットシーン、背景動画を挿入できます。最初から開始すると全動画を閉じ、位置、フェード、再生後移動、ボタンを初期化します。"),
        examples: [ex("[videoplay:影片ID|觀看影片]"), ex("[videojump:影片ID|3|觀看並繼續]"), ex("[cutscene:影片ID|3]"), ex("[videobg:影片ID]"), ex("[videofadeout]"), ex("[videooff]")]
      },
      {
        id: "official.gamebook-section-numbering-v3.1", category: "media", place: "ui",
        title: tri("紙本節號、圖片與 DOCX 書籤", "Print sections, images and DOCX bookmarks", "紙面セクション・画像・DOCXしおり"),
        summary: tri("按「📖 節號」為 Node 依序編號或隨機洗牌，可鎖定特定節號並固定第一頁為第 1 節。素材卡的「＋紙本圖」會插入紙本圖片標籤；輸出 DOCX 時會把 local-image 圖片封裝進 word/media，為每節建立 Word 書籤，並讓選項直接跳到目標節。Node UUID 仍是電子版真正連線。", "Use the Section button to number or shuffle nodes, lock selected numbers and keep the first node as section 1. Paper-image cards are packaged into DOCX media; every section gets a Word bookmark and choices link to their targets. Node UUIDs remain the real digital links.", "「節号」でNodeを連番・シャッフルし、番号を固定できます。紙面画像はDOCXへ同梱され、各節にWordしおりと選択肢リンクが作成されます。"),
        examples: [ex("[紙本圖片:local-image://px_圖片ID]", "content"), ex("[img:local-image://px_圖片ID]", "content")]
      },
      {
        id: "official.native-audio-style-tags-v3", category: "media", place: "content",
        title: tri("音訊按鈕樣式標籤 V3", "Audio button style tags V3", "音声ボタンスタイル V3"),
        summary: tri("把樣式標籤放在音訊按鈕標籤之前，只影響下一個音訊按鈕；冒號後可填 CSS 顏色。", "Place a style tag immediately before an audio tag. It affects the next audio button only; an optional CSS color follows the colon.", "音声タグの直前へ置き、次の音声ボタンだけに適用します。コロン後に色を指定できます。"),
        examples: [ex("[純文字無底線:#526b5a]\n[bgmplay:音訊ID|播放環境音]"), ex("[純文字底線:#1976d2]\n[bgmstop:音訊ID|停止]"), ex("[分歧按鈕:#7b4bb7]\n[bgmjump:音訊ID|2|播放並繼續]")]
      },
      {
        id: "official.audio-button-styles", category: "media", place: "content",
        title: tri("音樂按鈕多樣式", "Audio button themes", "音楽ボタンテーマ"),
        summary: tri("樣式標籤會套用到它後面的音樂按鈕。可用文字、選項、外框、膠囊、深色、警告、玻璃或小型。", "A style marker applies to following audio buttons. Styles: text, option, outline, pill, dark, danger, glass and compact.", "後続の音楽ボタンへ、文字、選択肢、枠線、カプセル、暗色、警告、ガラス、小型のスタイルを適用します。"),
        examples: [ex("[音樂按鈕樣式:警告]\n[bgmplay:音訊ID|播放危險音樂]"), ex("[音樂按鈕樣式:純文字]\n[bgmstop:音訊ID|停止]")]
      },
      {
        id: "official.reader-button-themes", category: "media", place: "content",
        title: tri("頁面按鈕主題", "Page button themes", "ページボタンテーマ"),
        summary: tri("設定整頁按鈕外觀，或建立單純顯示文字但不跳頁的按鈕。主題支援預設、藍、綠、紅、金、紫、黑、純文字、外框、膠囊、方形、玻璃、紙張、像素與霓虹。", "Theme every button on a page or create a non-navigation text button. Themes include default, colors, text, outline, pill, square, glass, paper, pixel and neon.", "ページ内ボタン全体のテーマ、または移動しない文字ボタンを作成します。"),
        examples: [ex("[按鈕樣式:玻璃]"), ex("[按鈕樣式:霓虹]"), ex("[文字按鈕:調查房間]"), ex("[文字按鈕:危險警告|紅色]")]
      },
      {
        id: "official.reader-comfort-tools", category: "media", place: "ui",
        title: tri("閱讀器舒適工具", "Reader comfort tools", "リーダー快適ツール"),
        summary: tri("在測試與輸出閱讀器提供字級、行距、深色模式、進度、全螢幕與鍵盤控制。使用方式：開啟測試閱讀後操作上方工具列；設定只保存在讀者瀏覽器。", "Adds font size, line spacing, dark mode, progress, fullscreen and keyboard controls to preview and exported readers. Use the reader toolbar; preferences stay in the reader browser.", "プレビューと出力リーダーに文字サイズ、行間、ダークモード、進捗、全画面を追加します。")
      },
      {
        id: "official.reader-dark-color-adapter", category: "media", place: "automatic",
        title: tri("閱讀器深色文字適配", "Dark-mode text adapter", "ダークモード文字補正"),
        summary: tri("深色模式時自動把過暗的作者文字調亮，切回淺色時還原；不需要標籤。範例：正文使用深灰色字，切換深色閱讀後仍會保持可讀。", "Automatically brightens overly dark author text in reader dark mode and restores it in light mode. No tag is required.", "ダークモードで暗すぎる本文色を自動補正し、ライトモードで元へ戻します。")
      },
      {
        id: "official.new-game-and-save-slots", category: "media", place: "ui",
        title: tri("重新開始與擴充存檔槽", "New game and expandable save slots", "ニューゲームと追加セーブ"),
        summary: tri("正式閱讀器會新增「重新開始」與更多手動存檔槽；重新開始會保留手動存檔，但重置目前進度、全部 RPG 資料、一次性事件、自動跳轉、音樂與影片播放器、背景媒體，以及所有已知插件按鈕狀態。作者不需標籤。", "Adds Restart and expandable manual save slots. Restart keeps manual slots while resetting current progress, RPG data, one-shot events, automatic jumps, audio/video players, background media, and every known plugin-button state.", "手動セーブ枠を保ち、現在進行、RPGデータ、一度きりのイベント、自動ジャンプ、音声・動画プレイヤー、背景メディア、既知のプラグインボタンをすべて初期化します。")
      },
      {
        id: "official.image-motion-studio", category: "media", place: "ui",
        title: tri("圖片演出工作室", "Image Motion Studio", "画像演出スタジオ"),
        summary: tri("先用素材庫插入 [img:…]，再從頂部「🖼 圖片演出」、素材卡「✨ 圖片特效」或排版工作室開啟。設定依「Node＋圖片出現順序」保存，可套用淡入、滑入、縮放、模糊、漂浮、呼吸、濾鏡、陰影、退場與 hover 效果，也能一次套用目前 Node 全部圖片。它只控制圖片層，不會搶走文字動畫。", "Insert an [img:…] asset, then open Image Motion from the header, its asset-card button or Layout Studio. Settings are saved by node and image order, with entrance, idle, filter, shadow, exit and hover effects. It controls only the image layer.", "素材画像を挿入後、画像演出画面で進入・待機・フィルター・影・退場・ホバー効果を設定します。画像レイヤーだけを制御します。"),
        examples: [ex("[img:local-image://px_圖片ID]", "content")]
      },
      {
        id: "official.docx-gamebook", category: "media", place: "ui",
        title: tri("DOCX 遊戲書匯出", "DOCX gamebook export", "DOCXゲームブック出力"),
        summary: tri("從工具箱開啟 DOCX 匯出，選擇是否包含節點編號、選項與附錄後下載。範例：完成故事後匯出可供校稿或列印的 Word 遊戲書。", "Open DOCX export from the toolbox, choose numbering, choices and appendices, then download a Word gamebook for editing or print.", "ツールボックスからDOCX出力を開き、校正・印刷用のWordゲームブックを作成します。")
      },
      {
        id: "official.i18n-zh-en-ja", category: "media", place: "ui",
        title: tri("繁中／英文／日文介面", "Chinese / English / Japanese UI", "繁中・英語・日本語UI"),
        summary: tri("使用右上角語言選單切換編輯器介面；輸出閱讀器也會有獨立語言選單。作品正文與作者自訂名稱不會被翻譯。", "Use the top-right selector to change the editor language. Exported readers receive their own selector. Story content and author-defined names are never translated.", "右上の言語選択でエディターを切り替えます。作品本文や作者名は翻訳されません。")
      },
      {
        id: "official.help-center", category: "start", place: "ui",
        title: tri("標籤與插件教學中心", "Tag and plugin help center", "タグ・プラグインヘルプ"),
        summary: tri("按 F1 或 Ctrl+/ 隨時開啟。可依分類篩選、搜尋插件 ID／功能／語法，並把範例複製或直接插入目前正文。", "Press F1 or Ctrl+/ at any time. Filter or search by plugin ID, feature or syntax, then copy examples or insert them into the current node.", "F1またはCtrl+/で開き、分類・検索・コピー・本文への挿入ができます。")
      },

      {
        id: "official.drawing-zoom-coordinate-fix", category: "editor", place: "automatic",
        title: tri("畫筆縮放座標修正", "Drawing zoom coordinate fix", "描画ズーム座標修正"),
        summary: tri("畫布縮放後仍讓自由畫筆與局部橡皮擦跟隨游標。範例：縮放到 150% 再繪圖，筆跡仍落在游標位置；不需要設定。", "Keeps freehand drawing and the local eraser aligned after canvas zoom. For example, draw at 150% zoom and strokes remain under the pointer.", "キャンバス拡大後もペンと消しゴムの座標をカーソルへ一致させます。")
      },
      {
        id: "official.node-box-delete", category: "editor", place: "ui",
        title: tri("Node 框選與 Delete", "Node box selection and Delete", "Node範囲選択とDelete"),
        summary: tri("拖曳空白畫布框選多個 Node，Ctrl／Cmd 點擊增減選取，Delete 刪除。第一頁受到保護；刪除前會同步清理連線與排版資料。", "Drag empty canvas to box-select nodes, Ctrl/Cmd-click to adjust selection, and press Delete to remove. The first page is protected.", "空白キャンバスをドラッグして複数Nodeを選択し、Deleteで削除します。最初のページは保護されます。")
      },
      {
        id: "official.node-action-context", category: "editor", place: "ui",
        title: tri("Node 操作與右鍵選單", "Node actions and context menu", "Node操作と右クリック"),
        summary: tri("對單一或多選 Node 按右鍵，可複製、剪下、貼上、刪除、重新命名與群組。範例：框選三個 Node 後右鍵選「複製」，再在空白畫布貼上。", "Right-click one or more selected nodes to copy, cut, paste, delete, rename or group them.", "選択したNodeを右クリックし、コピー、切り取り、貼り付け、削除、名前変更、グループ化を実行します。")
      },
      {
        id: "official.layout-studio-title-effects", category: "editor", place: "ui",
        title: tri("章節標題演出", "Chapter title effects", "章タイトル演出"),
        summary: tri("從頂部「章節標題演出」或排版工作室開啟，逐 Node 設定標題顏色、字級、字重、字距、對齊、陰影、進場動畫，以及停留後的淡出／上移／下移／縮放／模糊退場。若同時使用 Typography Studio，建議把 Typography 的標題進場與持續動畫設為 none，讓專用標題層負責演出。", "Open from the header or Layout Studio to style each node title and configure entrance plus timed fade, move, scale or blur exits. When Typography Studio is also active, set its title entrance and idle effects to none so this dedicated title layer owns the animation.", "ヘッダーまたはレイアウトスタジオから、各Nodeのタイトル書式・進入・時間指定退場を設定します。Typography Studio併用時はタイトルアニメーションをnoneにしてください。")
      },
      {
        id: "official.typography-motion-studio", category: "editor", place: "ui",
        title: tri("文字演出工作室", "Typography Motion Studio", "文字演出スタジオ"),
        summary: tri("從頂部「✨ 文字演出」或排版工作室開啟，分別調整章節標題、正文與選項的字型、顏色、字級、字重、字距、行高、進場和持續動畫。內建小說、遊戲 UI、恐怖、夢境、終端與復古預設，可套用目前 Node 或全部 Node；V1.1 只包裝文字節點，會排除圖片、影片、音訊與 Canvas。", "Open from the header or Layout Studio to style title, body and choices independently, including font, spacing, entrance and idle motion. Presets cover novel, game UI, horror, dream, terminal and retro themes; V1.1 excludes media and canvas nodes.", "タイトル・本文・選択肢ごとに字体、間隔、進入・待機アニメーションを設定します。V1.1は画像・動画・音声・Canvasを除外します。")
      },
      {
        id: "test.folder-node-performance-v3", category: "editor", place: "ui",
        title: tri("收納型資料夾 Node", "Folder nodes", "フォルダーNode"),
        summary: tri("從工具箱建立資料夾，把 Node 拖入資料夾卡片即可收納；雙擊或使用資料夾視窗查看與移出。凍結資料夾可降低大型專案畫布負擔。", "Create a folder from the toolbox and drag nodes onto its card. Open the folder window to inspect or move nodes out; freezing reduces large-canvas load.", "ツールボックスからフォルダーを作り、Nodeをカードへドラッグして収納します。")
      },
      {
        id: "official.system-settings", category: "editor", place: "ui",
        title: tri("系統設定", "System settings", "システム設定"),
        summary: tri("從工具箱或 Ctrl+Alt+S 開啟，調整工具箱位置、介面與效能偏好；可匯出／匯入設定。範例：把工具箱移到左下角並匯出設定檔。", "Open from the toolbox or Ctrl+Alt+S to adjust toolbox position, UI and performance preferences, and import/export settings.", "ツールボックスまたはCtrl+Alt+Sで開き、位置やUI、性能設定を変更します。")
      },
      {
        id: "official.toolbox-organizer", category: "editor", place: "ui",
        title: tri("工具箱整理器", "Toolbox organizer", "ツールボックス整理"),
        summary: tri("把分散的浮動工具收進右下角工具箱，支援搜尋、分類與開啟。範例：點「🧰 工具箱」後輸入「DOCX」快速找到匯出工具。", "Collects floating tools into the toolbox with search and categories. For example, open the toolbox and search DOCX.", "分散したツールを検索・分類付きツールボックスへまとめます。")
      },
      {
        id: "native.letter-permutation", category: "editor", place: "ui",
        title: tri("字母排列組合", "Letter permutations", "文字の順列"),
        summary: tri("從頂部「更多工具」開啟「✨ 字母組合」，輸入最多 6 個字元後產生全部排列；點結果即可複製。工具關閉後不會占用畫布。", "Open Letter permutations from More tools, enter up to six characters, generate all orders, and click a result to copy it. The tool stays off the canvas while closed.", "「その他のツール」から開き、最大6文字の全順列を生成して結果をクリックするとコピーできます。")
      },

      {
        id: "official.firehaha-kernel-scheduler", category: "core", place: "automatic",
        title: tri("Firehaha 核心排程器", "Firehaha kernel scheduler", "Firehahaコアスケジューラ"),
        summary: tri("自動合併重複畫面更新，將工作分配到動畫幀或瀏覽器空閒時間，背景分頁時暫停非必要更新。一般使用者不需操作。", "Automatically coalesces duplicate UI work, schedules frame and idle tasks, and pauses nonessential background updates. No user setup is required.", "重複更新をまとめ、描画フレームと空き時間へ処理を振り分けます。設定不要です。")
      },
      {
        id: "official.execution-performance-manager-v2", category: "core", place: "automatic",
        title: tri("執行效率總管 V2", "Execution performance manager V2", "実行性能マネージャー V2"),
        summary: tri("依正文長度、拖曳狀態與頁籤可見性自動調整預覽與繪線頻率。範例：編輯超長 Node 時預覽會延遲合併，而不是每次按鍵重畫。", "Adapts preview and line rendering to content size, dragging and tab visibility. Long nodes are batched instead of rerendering on every keystroke.", "本文量やドラッグ状態に応じてプレビューと線描画を自動調整します。")
      },
      {
        id: "official.kernel-visual-bridge", category: "core", place: "ui",
        title: tri("Kernel 視覺橋接器", "Kernel visual bridge", "Kernel可視化ブリッジ"),
        summary: tri("從頂部「更多工具」開啟；將舊插件的更新呼叫橋接到核心排程器，面板可查看攔截次數、節省率與開關。關閉或重新載入時會記住面板狀態。範例：按「測試橋接」確認流程連線與預覽排程正常。", "Open it from More tools. It routes legacy plugin updates through the kernel and shows interception counts, savings and controls; panel state is remembered. Use Test bridge for a quick check.", "「その他のツール」から開き、旧プラグイン更新をKernelへ橋接して統計と状態を確認します。パネル状態も保存されます。")
      },
      {
        id: "official.ultra-long-content-guard", category: "core", place: "automatic",
        title: tri("超長內容保護", "Ultra-long content guard", "超長文保護"),
        summary: tri("超長 Node 只產生安全摘要預覽，完整正文仍保留在專案與輸出。範例：貼入十二萬字時編輯器不會為了預覽建立同等大小 DOM。", "Uses a safe preview excerpt for huge nodes while preserving full project and export content.", "非常に長いNodeでは安全な抜粋だけをプレビューし、本文全体は保存・出力に保持します。")
      },
      {
        id: "official.preview-render-guard", category: "core", place: "automatic",
        title: tri("預覽渲染保護器", "Preview render guard", "プレビュー描画保護"),
        summary: tri("阻止其他模組在超長正文上重複渲染全文，避免切換 Node 卡住；不影響正式輸出。", "Prevents other modules from repeatedly rendering full ultra-long content. Export remains complete.", "超長文の重複全量描画を防ぎます。正式出力には影響しません。")
      },
      {
        id: "official.preview-selection-bridge", category: "core", place: "automatic",
        title: tri("Node 切換預覽橋樑", "Node preview selection bridge", "Node切替プレビューブリッジ"),
        summary: tri("切換到超長 Node 前暫時提供安全文字切片，切換完成立即還原完整正文。範例：在 300 個 Node 間快速點選時減少停頓。", "Temporarily provides a safe text slice while switching to a huge node, then restores the full content.", "超長Node切替中だけ安全な抜粋を使い、完了後に全文を戻します。")
      },
      {
        id: "official.large-project-performance", category: "core", place: "automatic",
        title: tri("大型專案效能輔助", "Large project performance helper", "大規模プロジェクト性能補助"),
        summary: tri("專案達到約 30 萬字或 300 Node 時自動啟用輕量畫布與效能提示。可在開發者中心查看是否進入大型模式。", "Automatically enables a lighter canvas around 300k characters or 300 nodes. Check the developer center for the active mode.", "約30万字または300Nodeで軽量キャンバスを自動有効化します。")
      },
      {
        id: "official.render-scheduler", category: "core", place: "automatic",
        title: tri("流程圖重繪排程器", "Flowchart render scheduler", "フローチャート再描画"),
        summary: tri("合併短時間內的重複連線重繪，讓大量 Node 拖曳更順暢。一般使用者不需操作。", "Coalesces repeated connector redraws to keep large-node dragging smooth. No setup is required.", "連線の重複再描画をまとめ、大量Nodeのドラッグを滑らかにします。")
      },

      {
        id: "official.firehaha-developer-center", category: "dev", place: "ui",
        title: tri("Firehaha 開發者中心", "Firehaha developer center", "Firehaha開発者センター"),
        summary: tri("從頂部「更多工具」開啟；查看核心、渲染、Kernel、插件、效能、事件與錯誤，關閉或重新載入時會記住面板狀態。範例：開啟「錯誤」分頁確認一般錯誤與 Promise 錯誤都是 0。", "Open it from More tools to inspect core, rendering, kernel, plugins, performance, events and errors. Panel state is remembered; for example, verify both error counters are zero.", "「その他のツール」から開き、コア、描画、Kernel、プラグイン、性能、イベント、エラーを確認します。パネル状態も保存されます。")
      },
      {
        id: "official.gamebook-inspector", category: "dev", place: "ui",
        title: tri("Gamebook 出版健檢器", "Gamebook publishing inspector", "Gamebook出版診断"),
        summary: tri("按頂部「🔍 健檢」分析目前 pages、options 與 UUID，找出不存在的選項目標、第一頁無法抵達的 Node、無出口頁、封閉循環、重複紙本節號，以及遺失的 local-image 圖片。可按「定位」回到問題 Node，並下載純文字報告；建議在每次正式輸出前執行。", "Use the Inspector button before publishing to find broken choice targets, unreachable nodes, dead ends, trapped cycles, duplicate print sections and missing local-image assets. Locate issues in the editor or export a text report.", "公開前に壊れた移動先、到達不能Node、出口なし、閉じた循環、重複節号、欠落画像を検査し、問題Nodeへ移動またはレポート出力できます。")
      },
      {
        id: "official.stress-test-300k", category: "dev", place: "ui",
        title: tri("30 萬字承壓測試", "300k-character stress test", "30万文字ストレステスト"),
        summary: tri("從開發／測試工具建立大型測試專案，量測建立時間、事件迴圈延遲與資料大小；測試完可一鍵移除測試 Node。請勿在正式專案未備份時使用。", "Generate a large test project and measure creation time, event-loop delay and size, then remove test nodes. Back up real work first.", "大型テストプロジェクトを生成し、時間・遅延・容量を測定します。実作品では先にバックアップしてください。")
      },
      {
        id: "official.demo-little-star", category: "dev", place: "automatic",
        title: tri("小星星示範插件", "Little star demo plugin", "小さな星デモ"),
        summary: tri("示範最小安全插件生命週期，在測試與輸出閱讀器右下角加入小星星，不讀寫專案。可用來確認 Reader Transform 正常。", "A minimal lifecycle example that adds a harmless star to preview and exported readers. It is useful for checking reader transforms.", "安全な最小例として、プレビューと出力リーダーへ小さな星を追加します。")
      },
      {
        id: "official.example-toy", category: "dev", place: "ui",
        title: tri("官方插件範例玩具", "Official example toy", "公式サンプルトイ"),
        summary: tri("展示 FirehahaPlugins.register、setup、樣式、Reader Transform 與 cleanup 的基本寫法。從 JS 插件管理器可下載範本，再更改插件 ID 後開發自己的插件。", "Demonstrates register, setup, styles, reader transforms and cleanup. Download the template from the JS plugin manager and change its ID before development.", "register、setup、スタイル、Reader Transform、cleanupの基本例です。")
      },

      { id: "shortcut.help", category: "shortcuts", place: "ui", title: tri("開啟教學", "Open help", "ヘルプを開く"), summary: tri("F1；不論焦點在何處都可開啟。非文字輸入狀態也可按 Ctrl+/。", "F1 works from anywhere. Ctrl+/ also opens help when you are not typing.", "F1はどこからでも使用できます。文字入力中以外はCtrl+/も使えます。"), examples: [] },
      { id: "shortcut.preview", category: "shortcuts", place: "ui", title: tri("測試閱讀", "Preview reader", "リーダープレビュー"), summary: tri("Ctrl+Enter：以目前格式開啟測試閱讀。", "Ctrl+Enter opens reader preview for the current format.", "Ctrl+Enterで現在形式のプレビューを開きます。"), examples: [] },
      { id: "shortcut.export", category: "shortcuts", place: "ui", title: tri("輸出測試閱讀器", "Export reader", "リーダー出力"), summary: tri("Ctrl+Shift+Enter：輸出目前格式的閱讀器。", "Ctrl+Shift+Enter exports the reader for the current format.", "Ctrl+Shift+Enterで現在形式のリーダーを出力します。"), examples: [] },
      { id: "shortcut.layout", category: "shortcuts", place: "ui", title: tri("開啟排版測試框", "Open layout studio", "レイアウトスタジオ"), summary: tri("Ctrl+Alt+L：開啟目前格式的排版測試框。", "Ctrl+Alt+L opens the layout studio for the current format.", "Ctrl+Alt+Lでレイアウトスタジオを開きます。"), examples: [] },
      { id: "shortcut.plugins", category: "shortcuts", place: "ui", title: tri("開啟 JS 插件管理器", "Open JS plugin manager", "JSプラグイン管理"), summary: tri("Ctrl+Alt+P：開啟插件管理器。", "Ctrl+Alt+P opens the plugin manager.", "Ctrl+Alt+Pでプラグイン管理を開きます。"), examples: [] },
      { id: "shortcut.settings", category: "shortcuts", place: "ui", title: tri("開啟系統設定", "Open system settings", "システム設定"), summary: tri("Ctrl+Alt+S：開啟系統設定。", "Ctrl+Alt+S opens system settings.", "Ctrl+Alt+Sでシステム設定を開きます。"), examples: [] },
      { id: "shortcut.history", category: "shortcuts", place: "ui", title: tri("復原與重做", "Undo and redo", "元に戻す・やり直し"), summary: tri("非文字輸入狀態使用 Ctrl+Z 復原；Ctrl+Y 或 Ctrl+Shift+Z 重做。", "Outside text fields, use Ctrl+Z to undo and Ctrl+Y or Ctrl+Shift+Z to redo.", "文字入力欄以外でCtrl+Zは元に戻す、Ctrl+YまたはCtrl+Shift+Zはやり直しです。"), examples: [] }
    ];

    const ui = {
      title: tri("Firehaha 標籤與插件教學中心", "Firehaha tag & plugin help", "Firehahaタグ・プラグインヘルプ"),
      subtitle: tri("所有已整合功能、RPG 語法、範例與快捷鍵", "All integrated features, RPG syntax, examples and shortcuts", "統合機能、RPG構文、例、ショートカット"),
      search: tri("搜尋標籤、插件 ID、功能或範例…", "Search tags, plugin IDs, features or examples…", "タグ、ID、機能、例を検索…"),
      copy: tri("複製", "Copy", "コピー"),
      insert: tri("插入正文", "Insert", "本文へ挿入"),
      examples: tri("使用範例", "Examples", "使用例"),
      location: tri("使用位置", "Use in", "使用場所"),
      pluginId: tri("插件 ID", "Plugin ID", "プラグインID"),
      none: tri("找不到符合的教學，請改用較短的關鍵字。", "No matching guide. Try a shorter search.", "一致するガイドがありません。短い語句で検索してください。"),
      close: tri("關閉", "Close", "閉じる"),
      clear: tri("清除搜尋", "Clear search", "検索をクリア"),
      copied: tri("已複製", "Copied", "コピーしました"),
      inserted: tri("已插入目前正文", "Inserted into current content", "現在の本文へ挿入しました"),
      choiceCopied: tri("選項標籤已複製，請貼到選項文字前方", "Choice tag copied; paste it at the start of choice text", "選択肢タグをコピーしました。選択肢の先頭へ貼り付けてください"),
      insertFailed: tri("找不到目前正文編輯器，已改為複製", "No current content editor; copied instead", "本文エディターが見つからないためコピーしました"),
      hint: tri("F1 教學 · Ctrl+Enter 測試閱讀", "F1 Help · Ctrl+Enter Preview", "F1 ヘルプ · Ctrl+Enter プレビュー")
    };

    const currentLanguage = () => {
      const value = window.FirehahaI18n && window.FirehahaI18n.language;
      if (value === "en" || value === "ja" || value === "zh-TW") return value;
      const htmlLanguage = document.documentElement.lang;
      return htmlLanguage === "en" || htmlLanguage === "ja" ? htmlLanguage : "zh-TW";
    };
    const localize = value => {
      if (!value || typeof value !== "object") return String(value == null ? "" : value);
      return value[currentLanguage()] || value["zh-TW"] || "";
    };
    const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

    const removeStyle = api.addStyle("help-center", `
      #firehahaHelpButton{position:fixed;left:18px;bottom:74px;z-index:2147482100;display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-radius:999px;background:linear-gradient(135deg,#1466b8,#6747a8);color:#fff;font-weight:850;box-shadow:0 9px 26px rgba(34,65,125,.32);cursor:pointer}
      #firehahaHelpButton:hover{filter:brightness(1.08);transform:translateY(-1px)}
      #firehahaHelpCenter{position:fixed;inset:0;z-index:2147483500;display:none;place-items:center;padding:18px;background:rgba(12,23,35,.56);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      #firehahaHelpCenter.open{display:grid}.fh-help-shell{display:grid;grid-template-rows:auto minmax(0,1fr);width:min(1180px,97vw);height:min(850px,94vh);overflow:hidden;border:1px solid #94a9bd;border-radius:18px;background:#eef3f7;color:#203244;box-shadow:0 28px 90px rgba(0,0,0,.4)}
      .fh-help-head{display:grid;grid-template-columns:minmax(220px,1fr) minmax(260px,430px) auto;align-items:center;gap:13px;padding:13px 16px;background:linear-gradient(135deg,#123d69,#4b327e);color:#fff}.fh-help-brand strong{display:block;font-size:18px}.fh-help-brand small{display:block;margin-top:2px;color:#d8e7f8}.fh-help-search-wrap{position:relative}.fh-help-search{width:100%;box-sizing:border-box;min-height:40px;padding:9px 42px 9px 12px;border:1px solid rgba(255,255,255,.38);border-radius:10px;background:rgba(255,255,255,.96);color:#17283a;font:inherit}.fh-help-clear{position:absolute;right:5px;top:5px;width:30px;height:30px;border:0;border-radius:7px;background:#e7edf3;color:#40556a;cursor:pointer}.fh-help-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.4);border-radius:10px;background:rgba(255,255,255,.13);color:#fff;font-size:20px;cursor:pointer}
      .fh-help-layout{display:grid;grid-template-columns:230px minmax(0,1fr);min-height:0}.fh-help-nav{overflow:auto;padding:12px;border-right:1px solid #cbd7e1;background:#f9fbfd}.fh-help-nav button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;margin:3px 0;padding:9px 10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#31475b;text-align:left;cursor:pointer}.fh-help-nav button:hover{background:#edf4fa}.fh-help-nav button.active{border-color:#8bb6dc;background:#dfeefa;color:#0e5795;font-weight:800}.fh-help-count{min-width:24px;padding:2px 6px;border-radius:999px;background:rgba(80,110,140,.13);font-size:11px;text-align:center}
      .fh-help-main{overflow:auto;padding:15px}.fh-help-status{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:11px;color:#627487;font-size:12px}.fh-help-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fh-help-card{min-width:0;padding:14px;border:1px solid #cbd7e1;border-radius:13px;background:#fff;box-shadow:0 3px 10px rgba(31,57,80,.06)}.fh-help-card h3{margin:0 0 7px;color:#173a5b;font-size:17px}.fh-help-card p{margin:7px 0;color:#4e6375;line-height:1.65}.fh-help-meta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.fh-help-chip{display:inline-flex;padding:3px 7px;border-radius:999px;background:#eaf2f8;color:#426079;font-size:11px}.fh-help-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.fh-help-card h4{margin:12px 0 7px;font-size:13px;color:#36526a}.fh-help-example{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:start;gap:6px;margin:7px 0;padding:8px;border-radius:9px;background:#172635;color:#eaf5ff}.fh-help-code{min-width:0;overflow-wrap:anywhere;white-space:pre-wrap;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.fh-help-example button{padding:5px 7px;border:1px solid #7694aa;border-radius:7px;background:#294b64;color:#fff;font-size:11px;cursor:pointer}.fh-help-example [data-help-insert]{border-color:#9a82d8;background:#583f8f}.fh-help-empty{grid-column:1/-1;padding:50px 20px;text-align:center;color:#687b8e}.fh-help-toast{position:absolute;left:50%;bottom:28px;z-index:2;max-width:min(620px,90vw);transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#15723c;color:#fff;box-shadow:0 7px 25px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .18s}.fh-help-toast.show{opacity:1}.fh-shortcuts-hint{display:inline-flex;align-items:center;margin-left:auto;padding:4px 8px;border-radius:999px;background:#e6f0f8;color:#45647e;font-size:11px;font-weight:750}
      @media(max-width:820px){#firehahaHelpCenter{padding:6px}.fh-help-shell{width:calc(100vw - 12px);height:calc(100dvh - 12px);border-radius:13px}.fh-help-head{grid-template-columns:1fr auto}.fh-help-search-wrap{grid-column:1/-1;grid-row:2}.fh-help-layout{grid-template-columns:1fr}.fh-help-nav{display:flex;gap:5px;overflow:auto;border-right:0;border-bottom:1px solid #cbd7e1}.fh-help-nav button{width:auto;min-width:max-content}.fh-help-grid{grid-template-columns:1fr}.fh-help-brand small{display:none}}
      @media(max-width:560px){#firehahaHelpButton{left:10px;bottom:66px;padding:9px 11px}.fh-help-main{padding:9px}.fh-help-card{padding:11px}.fh-help-example{grid-template-columns:1fr auto}.fh-help-example [data-help-insert]{grid-column:2}.fh-shortcuts-hint{display:none}}
    `);

    const button = document.createElement("button");
    button.id = "firehahaHelpButton";
    button.type = "button";
    document.body.appendChild(button);

    const center = document.createElement("section");
    center.id = "firehahaHelpCenter";
    center.setAttribute("role", "dialog");
    center.setAttribute("aria-modal", "true");
    center.setAttribute("aria-hidden", "true");
    center.innerHTML = '<div class="fh-help-shell"><header class="fh-help-head"><div class="fh-help-brand"><strong data-help-title></strong><small data-help-subtitle></small></div><div class="fh-help-search-wrap"><input class="fh-help-search" type="search" data-help-search><button type="button" class="fh-help-clear" data-help-clear>×</button></div><button type="button" class="fh-help-close" data-help-close>×</button></header><div class="fh-help-layout"><nav class="fh-help-nav" data-help-nav></nav><main class="fh-help-main"><div class="fh-help-status"><span data-help-status></span><span data-help-key>F1 · Ctrl+/</span></div><div class="fh-help-grid" data-help-grid></div></main></div></div><output class="fh-help-toast" data-help-toast></output>';
    document.body.appendChild(center);

    let activeCategory = "all";
    let searchTerm = "";
    let lastEditable = null;
    let toastTimer = 0;

    function showToast(message) {
      const toast = center.querySelector("[data-help-toast]");
      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
    }

    function normalizedSearch(entry) {
      const fields = [entry.id];
      [entry.title, entry.summary].forEach(value => {
        if (!value) return;
        fields.push(value["zh-TW"], value.en, value.ja);
      });
      (entry.examples || []).forEach(item => fields.push(item.code));
      return fields.join(" ").toLocaleLowerCase();
    }

    function filteredEntries() {
      const query = searchTerm.trim().toLocaleLowerCase();
      return entries.filter(entry => {
        if (activeCategory !== "all" && entry.category !== activeCategory) return false;
        return !query || normalizedSearch(entry).includes(query);
      });
    }

    function renderNav() {
      const nav = center.querySelector("[data-help-nav]");
      nav.innerHTML = Object.keys(categoryLabels).map(key => {
        const count = key === "all" ? entries.length : entries.filter(entry => entry.category === key).length;
        return '<button type="button" data-help-category="' + key + '" class="' + (key === activeCategory ? "active" : "") + '"><span>' + escapeHtml(localize(categoryLabels[key])) + '</span><span class="fh-help-count">' + count + '</span></button>';
      }).join("");
    }

    function renderCards() {
      const found = filteredEntries();
      const grid = center.querySelector("[data-help-grid]");
      center.querySelector("[data-help-status]").textContent = found.length + " / " + entries.length;
      if (!found.length) {
        grid.innerHTML = '<div class="fh-help-empty">' + escapeHtml(localize(ui.none)) + '</div>';
        return;
      }
      grid.innerHTML = found.map(entry => {
        const examples = (entry.examples || []).map(item => {
          return '<div class="fh-help-example"><code class="fh-help-code">' + escapeHtml(item.code) + '</code><button type="button" data-help-copy="' + escapeHtml(item.code) + '">' + escapeHtml(localize(ui.copy)) + '</button><button type="button" data-help-insert="' + escapeHtml(item.code) + '" data-help-place="' + escapeHtml(item.place || entry.place || "content") + '">' + escapeHtml(localize(ui.insert)) + '</button></div>';
        }).join("");
        return '<article class="fh-help-card" data-help-entry="' + escapeHtml(entry.id) + '"><h3>' + escapeHtml(localize(entry.title)) + '</h3><div class="fh-help-meta"><span class="fh-help-chip">' + escapeHtml(localize(ui.location)) + '：' + escapeHtml(localize(placeLabels[entry.place || "automatic"])) + '</span><span class="fh-help-chip fh-help-id">' + escapeHtml(entry.id) + '</span></div><p>' + escapeHtml(localize(entry.summary)) + '</p>' + (examples ? '<h4>' + escapeHtml(localize(ui.examples)) + '</h4>' + examples : "") + '</article>';
      }).join("");
    }

    function render() {
      button.textContent = "📘 " + (currentLanguage() === "en" ? "Help" : currentLanguage() === "ja" ? "ヘルプ" : "教學");
      button.title = localize(ui.title) + " (F1)";
      center.setAttribute("aria-label", localize(ui.title));
      center.querySelector("[data-help-title]").textContent = localize(ui.title);
      center.querySelector("[data-help-subtitle]").textContent = localize(ui.subtitle);
      center.querySelector("[data-help-search]").placeholder = localize(ui.search);
      center.querySelector("[data-help-clear]").title = localize(ui.clear);
      center.querySelector("[data-help-close]").title = localize(ui.close);
      renderNav();
      renderCards();
      installActionHints();
    }

    function copyText(value, successMessage) {
      const fallback = () => {
        const helper = document.createElement("textarea");
        helper.value = value;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        try { document.execCommand("copy"); } catch (error) {}
        helper.remove();
        showToast(successMessage || localize(ui.copied));
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => showToast(successMessage || localize(ui.copied)), fallback);
      } else fallback();
    }

    function insertIntoEditor(value, place) {
      if (place === "choice" && (!lastEditable || lastEditable.id === "pageText")) {
        copyText(value, localize(ui.choiceCopied));
        return;
      }
      let editor = lastEditable;
      if (!editor || !editor.isConnected || !(editor.matches("textarea,input[type='text'],[contenteditable='true']"))) {
        editor = document.getElementById("pageText");
      }
      if (!editor) {
        copyText(value, localize(ui.insertFailed));
        return;
      }
      if (editor.isContentEditable) {
        editor.focus();
        document.execCommand("insertText", false, value);
      } else if (typeof editor.setRangeText === "function") {
        editor.focus();
        const start = Number.isFinite(editor.selectionStart) ? editor.selectionStart : editor.value.length;
        const end = Number.isFinite(editor.selectionEnd) ? editor.selectionEnd : start;
        const prefix = start > 0 && editor.value[start - 1] !== "\n" ? "\n" : "";
        const suffix = end < editor.value.length && editor.value[end] !== "\n" ? "\n" : "";
        editor.setRangeText(prefix + value + suffix, start, end, "end");
      } else {
        copyText(value, localize(ui.insertFailed));
        return;
      }
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      showToast(localize(ui.inserted));
    }

    function open(search) {
      const legacy = document.getElementById("gamebookTagGuide");
      if (legacy) legacy.classList.remove("open");
      if (typeof search === "string") {
        searchTerm = search;
        center.querySelector("[data-help-search]").value = search;
      }
      center.classList.add("open");
      center.setAttribute("aria-hidden", "false");
      render();
      requestAnimationFrame(() => center.querySelector("[data-help-search]").focus());
    }

    function close() {
      center.classList.remove("open");
      center.setAttribute("aria-hidden", "true");
    }

    function visibleAction(action) {
      return Array.from(document.querySelectorAll('[data-reader-action="' + action + '"]')).find(element => element.getClientRects().length && !element.disabled);
    }

    function installActionHints() {
      document.querySelectorAll(".format-reader-actions").forEach(bar => {
        if (!bar.querySelector(".fh-shortcuts-hint")) {
          const hint = document.createElement("span");
          hint.className = "fh-shortcuts-hint";
          bar.appendChild(hint);
        }
        const hint = bar.querySelector(".fh-shortcuts-hint");
        const hintText = localize(ui.hint);
        // MutationObserver 也會看到文字節點替換；只有內容真的改變時才寫入，避免自我觸發迴圈。
        if (hint.textContent !== hintText) hint.textContent = hintText;
        const test = bar.querySelector('[data-reader-action="test"]');
        const output = bar.querySelector('[data-reader-action="export"]');
        const layout = bar.querySelector('[data-reader-action="layout"]');
        if (test) test.title = "Ctrl+Enter";
        if (output) output.title = "Ctrl+Shift+Enter";
        if (layout) layout.title = "Ctrl+Alt+L";
      });
      const pluginButton = document.getElementById("firehahaPluginButton");
      if (pluginButton) pluginButton.title = "Ctrl+Alt+P";
    }

    function onClick(event) {
      const category = event.target.closest("[data-help-category]");
      if (category) {
        activeCategory = category.dataset.helpCategory;
        renderNav();
        renderCards();
        return;
      }
      const copy = event.target.closest("[data-help-copy]");
      if (copy) {
        copyText(copy.dataset.helpCopy || "");
        return;
      }
      const insert = event.target.closest("[data-help-insert]");
      if (insert) insertIntoEditor(insert.dataset.helpInsert || "", insert.dataset.helpPlace || "content");
    }

    function onKeydown(event) {
      const key = String(event.key || "").toLowerCase();
      const typing = event.target && event.target.closest && event.target.closest("textarea,input,[contenteditable='true']");
      if (event.key === "F1" || ((event.ctrlKey || event.metaKey) && key === "/" && !typing)) {
        event.preventDefault();
        open();
        return;
      }
      if (center.classList.contains("open")) {
        if (event.key === "Escape") { event.preventDefault(); close(); return; }
        if (key === "/" && !typing) { event.preventDefault(); center.querySelector("[data-help-search]").focus(); return; }
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "Enter") {
        const action = visibleAction("export");
        if (action) { event.preventDefault(); action.click(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === "Enter") {
        const action = visibleAction("test");
        if (action) { event.preventDefault(); action.click(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && key === "l") {
        const action = visibleAction("layout");
        if (action) { event.preventDefault(); action.click(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && key === "p") {
        if (window.FirehahaPlugins && typeof window.FirehahaPlugins.open === "function") { event.preventDefault(); window.FirehahaPlugins.open(); }
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.altKey && key === "s") {
        if (window.FirehahaSystemSettings && typeof window.FirehahaSystemSettings.open === "function") { event.preventDefault(); window.FirehahaSystemSettings.open(); }
      }
    }

    button.addEventListener("click", () => open());
    center.querySelector("[data-help-close]").addEventListener("click", close);
    center.querySelector("[data-help-clear]").addEventListener("click", () => {
      searchTerm = "";
      center.querySelector("[data-help-search]").value = "";
      renderCards();
      center.querySelector("[data-help-search]").focus();
    });
    center.querySelector("[data-help-search]").addEventListener("input", event => {
      searchTerm = event.target.value;
      renderCards();
    });
    center.addEventListener("click", onClick);
    center.addEventListener("click", event => { if (event.target === center) close(); });
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("focusin", event => {
      if (event.target && event.target.matches && event.target.matches("textarea,input[type='text'],[contenteditable='true']") && !event.target.closest("#firehahaHelpCenter")) lastEditable = event.target;
    }, true);
    const onLanguageChanged = () => render();
    document.addEventListener("firehaha:language-changed", onLanguageChanged);
    const observer = new MutationObserver(installActionHints);
    observer.observe(document.body, { childList: true, subtree: true });

    window.FirehahaHelpCenter = Object.freeze({ version: "1.1.3", open, close, entries: entries.slice(), search(value) { open(String(value || "")); } });
    render();
    installActionHints();

    return function cleanup() {
      observer.disconnect();
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("firehaha:language-changed", onLanguageChanged);
      button.remove();
      center.remove();
      removeStyle();
      if (window.FirehahaHelpCenter && window.FirehahaHelpCenter.version === "1.1.3") delete window.FirehahaHelpCenter;
    };
  }
});
