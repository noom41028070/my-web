// @firehaha-plugin {"id":"official.i18n-zh-en-ja","name":"官方多語言介面包","version":"1.0.0","author":"Firehaha 官方開發者","description":"為編輯器與輸出閱讀器提供繁體中文、English、日本語介面，不翻譯作者的作品內容。"}

FirehahaPlugins.register({
  id: "official.i18n-zh-en-ja",
  name: "官方多語言介面包",
  version: "1.0.0",
  description: "繁體中文、English、日本語介面與閱讀器語言切換",

  setup(api) {
    const STORAGE_KEY = "firehaha.ui.language";
    const SUPPORTED = ["zh-TW", "en", "ja"];

    const dictionary = {
      en: {
        "新增獨立頁面": "New standalone page",
        "保存專案": "Save project",
        "開啟專案": "Open project",
        "分析劇情": "Analyze story",
        "素材庫": "Asset library",
        "便利貼": "Notes",
        "畫筆模式": "Draw mode",
        "骰子": "Dice",
        "複製": "Copy",
        "貼上": "Paste",
        "生成分歧": "Generate branches",
        "啟用清單": "Enable list",
        "更多工具": "More tools",
        "章節設定": "Chapter settings",
        "編輯器": "Editor",
        "Pixiv 格式": "Pixiv format",
        "HTML 設計": "HTML design",
        "分歧選項": "Branch choices",
        "新增選項": "Add choice",
        "測試閱讀": "Test reader",
        "輸出測試閱讀": "Export test reader",
        "排版測試框": "Layout studio",
        "取得物品": "Gain item",
        "失去物品": "Lose item",
        "記錄事件": "Record event",
        "取消事件": "Clear event",
        "隱藏選項標籤": "Conditional choice tag",
        "遊戲清單": "Game list",
        "標籤教學": "Tag guide",
        "屬性／修正值": "Attribute / modifier",
        "技能／修正值": "Skill / modifier",
        "目標值檢定": "Target check",
        "進階檢定等級": "Advanced check levels",
        "自然骰等級": "Natural-roll levels",
        "傷害骰": "Damage roll",
        "重擊規則": "Critical rule",
        "成功骰池": "Success dice pool",
        "規則範例模板": "Rule templates",
        "命運骰 4dF": "Fate dice 4dF",
        "JS 插件": "JS Plugins",
        "Firehaha JS 插件管理器": "Firehaha JS Plugin Manager",
        "匯入 .js 插件": "Import .js plugin",
        "下載官方插件範本": "Download official template",
        "重新整理": "Refresh",
        "關閉": "Close",
        "停用": "Disable",
        "啟用": "Enable",
        "移除": "Remove",
        "官方開發者插入入口": "Official developer entry",
        "檢查並安裝": "Validate and install",
        "標記為官方插件": "Mark as official plugin",
        "驗證預覽＝輸出": "Verify preview = export",
        "同源閱讀核心待驗證": "Shared reader core pending",
        "排版測試框": "Layout studio",
        "顯示工具面板": "Show tool panel",
        "套用並測試閱讀": "Apply and test",
        "驗證排版": "Validate layout",
        "輸出閱讀器": "Export reader",
        "桌面 16：9": "Desktop 16:9",
        "返回": "Back",
        "狀態": "Status",
        "全螢幕": "Fullscreen",
        "滿版": "Fill screen",
        "冒險紀錄": "Adventure log",
        "存檔／讀取": "Save / Load",
        "顯示全文": "Show all text",
        "深色": "Dark",
        "淺色": "Light",
        "速度：標準": "Speed: Normal",
        "速度：快速": "Speed: Fast",
        "速度：慢速": "Speed: Slow",
        "打字動畫：開": "Typewriter: On",
        "打字動畫：關": "Typewriter: Off",
        "尚無記錄": "No records yet",
        "尚無物品": "No items",
        "尚無事件": "No events",
        "尚未檢定": "No checks yet",
        "尚未擲骰": "No rolls yet"
      },

      ja: {
        "新增獨立頁面": "独立ページを追加",
        "保存專案": "プロジェクトを保存",
        "開啟專案": "プロジェクトを開く",
        "分析劇情": "ストーリー分析",
        "素材庫": "素材ライブラリ",
        "便利貼": "メモ",
        "畫筆模式": "描画モード",
        "骰子": "ダイス",
        "複製": "コピー",
        "貼上": "貼り付け",
        "生成分歧": "分岐を生成",
        "啟用清單": "リストを有効化",
        "更多工具": "その他のツール",
        "章節設定": "チャプター設定",
        "編輯器": "エディター",
        "Pixiv 格式": "Pixiv形式",
        "HTML 設計": "HTMLデザイン",
        "分歧選項": "分岐選択肢",
        "新增選項": "選択肢を追加",
        "測試閱讀": "テストプレイ",
        "輸出測試閱讀": "テストリーダー出力",
        "排版測試框": "レイアウトスタジオ",
        "取得物品": "アイテム取得",
        "失去物品": "アイテム喪失",
        "記錄事件": "イベント記録",
        "取消事件": "イベント解除",
        "隱藏選項標籤": "条件付き選択肢タグ",
        "遊戲清單": "ゲームリスト",
        "標籤教學": "タグガイド",
        "屬性／修正值": "能力値／修正値",
        "技能／修正值": "技能／修正値",
        "目標值檢定": "目標値判定",
        "進階檢定等級": "上級判定レベル",
        "自然骰等級": "出目判定レベル",
        "傷害骰": "ダメージロール",
        "重擊規則": "クリティカル規則",
        "成功骰池": "成功ダイスプール",
        "規則範例模板": "ルール例テンプレート",
        "命運骰 4dF": "Fateダイス 4dF",
        "JS 插件": "JSプラグイン",
        "Firehaha JS 插件管理器": "Firehaha JSプラグイン管理",
        "匯入 .js 插件": ".jsプラグインを読み込む",
        "下載官方插件範本": "公式テンプレートを保存",
        "重新整理": "更新",
        "關閉": "閉じる",
        "停用": "無効化",
        "啟用": "有効化",
        "移除": "削除",
        "官方開發者插入入口": "公式開発者入力",
        "檢查並安裝": "検証してインストール",
        "標記為官方插件": "公式プラグインとして表示",
        "驗證預覽＝輸出": "プレビュー＝出力を検証",
        "同源閱讀核心待驗證": "共通リーダーを検証待ち",
        "顯示工具面板": "ツールパネルを表示",
        "套用並測試閱讀": "適用してテスト",
        "驗證排版": "レイアウトを検証",
        "輸出閱讀器": "リーダーを出力",
        "桌面 16：9": "デスクトップ 16:9",
        "返回": "戻る",
        "狀態": "状態",
        "全螢幕": "全画面",
        "滿版": "画面に合わせる",
        "冒險紀錄": "冒険記録",
        "存檔／讀取": "セーブ／ロード",
        "顯示全文": "全文表示",
        "深色": "ダーク",
        "淺色": "ライト",
        "速度：標準": "速度：標準",
        "速度：快速": "速度：高速",
        "速度：慢速": "速度：低速",
        "打字動畫：開": "タイプ演出：オン",
        "打字動畫：關": "タイプ演出：オフ",
        "尚無記錄": "記録はありません",
        "尚無物品": "アイテムはありません",
        "尚無事件": "イベントはありません",
        "尚未檢定": "判定はまだありません",
        "尚未擲骰": "ダイスはまだ振られていません"
      }
    };

    const tutorialDictionary = {
      en: {
        "📘 Gamebook 標籤教學": "📘 Gamebook Tag Guide",
        "最重要的規則：": "The most important rule:",
        "最重要的規則：放在內文的標籤會在讀者進入該頁時執行；放在「選項文字」前面的 [隱藏:…] 只控制那一個選項。所有沒有隱藏標籤的選項永遠顯示。": "The most important rule: tags in node content execute when the reader enters that page. A [隱藏:…] tag at the start of choice text controls only that choice. Choices without a condition tag are always visible.",
        "🎒 物品": "🎒 Items",
        "讀者進入頁面時取得或失去物品。": "Gain or lose items when the reader enters a page.",
        "選項文字：": "Choice text:",
        "🚩 事件旗幟": "🚩 Event flags",
        "記錄故事曾經發生過什麼；它不是顯示給讀者的劇透。": "Record what has happened in the story without revealing spoilers to the reader.",
        "🔢 一般數值": "🔢 General values",
        "設定、增加或減少體力、金錢、好感等會變動的數值。": "Set, increase, or decrease changing values such as health, money, and affection.",
        "💪 角色屬性": "💪 Character attributes",
        "適合力量、敏捷、意志等基礎能力；骰子不會覆蓋屬性值。": "For basic abilities such as Strength, Agility, and Will. Dice never overwrite attribute values.",
        "📚 角色技能": "📚 Character skills",
        "技能獨立於屬性，適合開鎖、駕駛、醫療、調查等後天能力。": "Skills are stored separately from attributes and suit learned abilities such as Lockpicking, Driving, Medicine, and Investigation.",
        "📜 任務": "📜 Quests",
        "狀態名稱由作者決定，例如未開始、進行中、完成或失敗。": "The author defines state names, such as Not Started, Active, Complete, or Failed.",
        "🎲 故事骰子": "🎲 Story dice",
        "沒有屬性時只擲骰；指定已建立的屬性時，會自動加入該屬性的修正值。": "Roll without an attribute, or specify an existing attribute to add its modifier automatically.",
        "依最近一次骰值顯示選項：": "Show a choice using the latest roll:",
        "🎯 目標值檢定": "🎯 Target checks",
        "放置位置：": "Where to place it:",
        "放置位置：[屬性:…] 或 [技能:…]、[檢定等級:…] 與 [檢定:…] 放進 Node 的「內文」；[隱藏:檢定:…] 放進該 Node 下方的「選項文字」。": "Place [屬性:…] or [技能:…], [檢定等級:…], and [檢定:…] in node content. Place [隱藏:檢定:…] in the choice text below that node.",
        "在內文先設定比較目標：[技能:開鎖=60] 或 [屬性:力量=14]": "First define the target in node content: [技能:開鎖=60] or [屬性:力量=14].",
        "需要進階結果時，先列出門檻，再放入可點擊的檢定骰。": "For advanced results, list thresholds before the clickable check die.",
        "在選項文字前加入對應的結果條件。": "Add the matching result condition at the start of each choice.",
        "基礎格式為「檢定名稱、骰式、比較符號、目標類型與名稱」。": "The basic format is check name, dice formula, comparison operator, target type, and target name.",
        "以下放在選項文字：": "Place the following in choice text:",
        "🧰 進階檢定等級": "🧰 Advanced check levels",
        "順序就是優先權：": "Order is priority:",
        "順序就是優先權：請把最特殊的結果放在最前面。第一條符合的門檻就是最後結果。": "Order determines priority. Put the most exceptional result first; the first matching threshold becomes the final result.",
        "選項可以使用任何自訂等級名稱：": "Choices can use any custom result name:",
        "🎯 固定目標與自然骰": "🎯 Fixed targets and natural rolls",
        "檢定不一定需要屬性或技能；最後一欄直接填數字，就是固定目標值。自然骰等級只看骰面，不受 +5 等修正影響。": "A check does not require an attribute or skill. A number in the final field is a fixed target. Natural-roll levels use only the die face and ignore modifiers such as +5.",
        "完整重擊流程：": "Complete critical-hit flow:",
        "先點「攻擊」檢定。": "Click the Attack check first.",
        "自然骰為 20 時，結果記為大成功。": "A natural 20 records a critical success.",
        "再點「長劍」傷害骰，1d8 會改擲兩顆；固定 +3 不會重複。": "Then click the Longsword damage roll. 1d8 becomes two dice, while the fixed +3 is added only once.",
        "這只是通用範例。自然 1、自然 20、重擊方式都由設計者自行決定。": "This is a generic example. The designer decides how natural 1, natural 20, and critical hits work.",
        "⚔️ 傷害骰與重擊": "⚔️ Damage rolls and critical hits",
        "先完成命中檢定，再點擊傷害骰。重擊標籤將指定檢定結果連到同名傷害骰。": "Complete the attack check before rolling damage. A critical tag links a check result to the damage roll with the same name.",
        "同一把武器只使用一條重擊規則。選項文字：": "Use only one critical rule for each weapon. Choice text:",
        "🎲 成功骰池": "🎲 Success dice pools",
        "格式為「名稱、骰池、每顆成功門檻、需要的成功顆數」。例如 5d6 中每顆 ≥5 算一個成功，至少需要兩個。": "Format: name, dice pool, success threshold per die, and required successes. For example, in 5d6 each die ≥5 is one success, and at least two are required.",
        "兩種選項條件皆可使用：": "Both kinds of choice condition are supported:",
        "💾 閱讀控制": "💾 Reader controls",
        "控制返回與存檔，或建立自動存檔點。": "Control backtracking and saving, or create an automatic save point.",
        "📝 Pixiv／純文字排版標籤總覽": "📝 Pixiv / plain-text formatting tags",
        "這些標籤放在 Node 內文，負責文字外觀、分頁與連結，不會改變冒險狀態。": "Place these tags in node content to control appearance, pagination, and links. They do not change adventure state.",
        "顯示全部排版標籤": "Show all formatting tags",
        "章節與跳頁：": "Chapters and navigation:",
        "標題：": "Headings:",
        "字體：": "Text styles:",
        "外觀：": "Appearance:",
        "清單：": "Lists:",
        "注音：": "Ruby text:",
        "連結與圖片：": "Links and images:",
        "🧪 完整流程範例": "🧪 Complete workflow example",
        "第一頁一般選項：探索守衛室": "Normal choice on page one: Explore the guard room.",
        "守衛室內文加入 [取得:銀色鑰匙] 與 [旗幟:見過守門人]": "Add [取得:銀色鑰匙] and [旗幟:見過守門人] to the guard-room content.",
        "回到第一頁後，帶有 [隱藏:持有:銀色鑰匙] 的開門選項便會出現。": "After returning to page one, the door choice with [隱藏:持有:銀色鑰匙] appears.",
        "名稱必須完全相同；例如「銀色鑰匙」和「銀色 鑰匙」會被視為不同物品。": "Names must match exactly. For example, 「銀色鑰匙」 and 「銀色 鑰匙」 are treated as different items.",
        "攜帶物品": "Inventory",
        "事件足跡": "Event history",
        "一般數值": "General values",
        "角色屬性": "Attributes",
        "角色技能": "Skills",
        "最近擲骰結果": "Latest dice results",
        "傷害結果": "Damage results",
        "任務": "Quests",
        "安全提醒：": "Security notice:",
        "JavaScript 插件擁有與編輯器相同的權限，能讀寫專案、介面與瀏覽器儲存。只安裝你信任的作者所提供的檔案。": "JavaScript plugins have the same privileges as the editor and can access projects, the interface, and browser storage. Install files only from authors you trust.",
        "尚未安裝外部插件。核心功能不受影響。": "No external plugins are installed. Core features are unaffected."
      },
      ja: {
        "📘 Gamebook 標籤教學": "📘 Gamebookタグガイド",
        "最重要的規則：": "最も重要なルール：",
        "最重要的規則：放在內文的標籤會在讀者進入該頁時執行；放在「選項文字」前面的 [隱藏:…] 只控制那一個選項。所有沒有隱藏標籤的選項永遠顯示。": "最も重要なルール：本文内のタグは読者がページに入った時に実行されます。選択肢の先頭に置く [隱藏:…] は、その選択肢だけを制御します。条件タグのない選択肢は常に表示されます。",
        "🎒 物品": "🎒 アイテム",
        "讀者進入頁面時取得或失去物品。": "読者がページに入った時にアイテムを取得・喪失します。",
        "選項文字：": "選択肢テキスト：",
        "🚩 事件旗幟": "🚩 イベントフラグ",
        "記錄故事曾經發生過什麼；它不是顯示給讀者的劇透。": "物語で起きた出来事を、読者へのネタバレなしに記録します。",
        "🔢 一般數值": "🔢 一般数値",
        "設定、增加或減少體力、金錢、好感等會變動的數值。": "体力、所持金、好感度などの変動値を設定・増減します。",
        "💪 角色屬性": "💪 キャラクター能力値",
        "適合力量、敏捷、意志等基礎能力；骰子不會覆蓋屬性值。": "筋力、敏捷、意志などの基礎能力向けです。ダイス結果は能力値を上書きしません。",
        "📚 角色技能": "📚 キャラクター技能",
        "技能獨立於屬性，適合開鎖、駕駛、醫療、調查等後天能力。": "技能は能力値とは別に保存され、鍵開け、運転、医療、調査などの習得能力に使います。",
        "📜 任務": "📜 クエスト",
        "狀態名稱由作者決定，例如未開始、進行中、完成或失敗。": "未開始、進行中、完了、失敗など、状態名は作者が決められます。",
        "🎲 故事骰子": "🎲 ストーリーダイス",
        "沒有屬性時只擲骰；指定已建立的屬性時，會自動加入該屬性的修正值。": "能力値なしで振るか、作成済み能力値を指定して修正値を自動加算します。",
        "依最近一次骰值顯示選項：": "最新の出目で選択肢を表示：",
        "🎯 目標值檢定": "🎯 目標値判定",
        "放置位置：": "配置場所：",
        "放置位置：[屬性:…] 或 [技能:…]、[檢定等級:…] 與 [檢定:…] 放進 Node 的「內文」；[隱藏:檢定:…] 放進該 Node 下方的「選項文字」。": "[屬性:…] または [技能:…]、[檢定等級:…]、[檢定:…] はNode本文へ、[隱藏:檢定:…] はそのNodeの選択肢テキストへ配置します。",
        "在內文先設定比較目標：[技能:開鎖=60] 或 [屬性:力量=14]": "本文で比較対象を先に設定します：[技能:開鎖=60] または [屬性:力量=14]。",
        "需要進階結果時，先列出門檻，再放入可點擊的檢定骰。": "上級結果を使う場合、しきい値を先に並べ、その後にクリック可能な判定ダイスを置きます。",
        "在選項文字前加入對應的結果條件。": "選択肢の先頭に対応する結果条件を追加します。",
        "基礎格式為「檢定名稱、骰式、比較符號、目標類型與名稱」。": "基本形式は判定名、ダイス式、比較演算子、対象タイプ、対象名です。",
        "以下放在選項文字：": "以下は選択肢テキストに配置：",
        "🧰 進階檢定等級": "🧰 上級判定レベル",
        "順序就是優先權：": "順序が優先順位です：",
        "順序就是優先權：請把最特殊的結果放在最前面。第一條符合的門檻就是最後結果。": "順序が優先順位です。最も特殊な結果を先頭に置き、最初に一致したしきい値が最終結果になります。",
        "選項可以使用任何自訂等級名稱：": "選択肢には任意の結果名を使用できます：",
        "🎯 固定目標與自然骰": "🎯 固定目標とナチュラルロール",
        "檢定不一定需要屬性或技能；最後一欄直接填數字，就是固定目標值。自然骰等級只看骰面，不受 +5 等修正影響。": "判定に能力値や技能は必須ではありません。最後の欄に数値を直接入れると固定目標になります。ナチュラルロールはダイス面だけを見て、+5などの修正を無視します。",
        "完整重擊流程：": "クリティカルの完全な流れ：",
        "先點「攻擊」檢定。": "最初に「攻撃」判定をクリックします。",
        "自然骰為 20 時，結果記為大成功。": "ナチュラル20なら大成功として記録します。",
        "再點「長劍」傷害骰，1d8 會改擲兩顆；固定 +3 不會重複。": "次に「長剣」ダメージを振ります。1d8は2個になりますが、固定+3は一度だけ加算されます。",
        "這只是通用範例。自然 1、自然 20、重擊方式都由設計者自行決定。": "これは汎用例です。ナチュラル1、20、クリティカル方式は設計者が決めます。",
        "⚔️ 傷害骰與重擊": "⚔️ ダメージとクリティカル",
        "先完成命中檢定，再點擊傷害骰。重擊標籤將指定檢定結果連到同名傷害骰。": "命中判定を完了してからダメージを振ります。クリティカルタグは判定結果を同名のダメージロールへ接続します。",
        "同一把武器只使用一條重擊規則。選項文字：": "武器ごとにクリティカル規則は1つだけ使用します。選択肢テキスト：",
        "🎲 成功骰池": "🎲 成功ダイスプール",
        "格式為「名稱、骰池、每顆成功門檻、需要的成功顆數」。例如 5d6 中每顆 ≥5 算一個成功，至少需要兩個。": "形式は名前、ダイスプール、各ダイスの成功しきい値、必要成功数です。例：5d6で各ダイス≥5を1成功とし、2成功以上を必要とします。",
        "兩種選項條件皆可使用：": "2種類の選択肢条件を使用できます：",
        "💾 閱讀控制": "💾 リーダー制御",
        "控制返回與存檔，或建立自動存檔點。": "戻る操作とセーブを制御し、自動セーブポイントを作成します。",
        "📝 Pixiv／純文字排版標籤總覽": "📝 Pixiv／プレーンテキスト書式タグ",
        "這些標籤放在 Node 內文，負責文字外觀、分頁與連結，不會改變冒險狀態。": "これらのタグはNode本文に置き、文字装飾、改ページ、リンクを制御します。冒険状態は変更しません。",
        "顯示全部排版標籤": "すべての書式タグを表示",
        "章節與跳頁：": "チャプターと移動：",
        "標題：": "見出し：",
        "字體：": "文字スタイル：",
        "外觀：": "外観：",
        "清單：": "リスト：",
        "注音：": "ルビ：",
        "連結與圖片：": "リンクと画像：",
        "🧪 完整流程範例": "🧪 完全な手順例",
        "第一頁一般選項：探索守衛室": "1ページ目の通常選択肢：衛兵室を探索する。",
        "守衛室內文加入 [取得:銀色鑰匙] 與 [旗幟:見過守門人]": "衛兵室の本文に [取得:銀色鑰匙] と [旗幟:見過守門人] を追加します。",
        "回到第一頁後，帶有 [隱藏:持有:銀色鑰匙] 的開門選項便會出現。": "1ページ目へ戻ると、[隱藏:持有:銀色鑰匙] の付いた扉を開ける選択肢が表示されます。",
        "名稱必須完全相同；例如「銀色鑰匙」和「銀色 鑰匙」會被視為不同物品。": "名前は完全一致が必要です。「銀色鑰匙」と「銀色 鑰匙」は別のアイテムとして扱われます。",
        "攜帶物品": "所持アイテム",
        "事件足跡": "イベント履歴",
        "一般數值": "一般数値",
        "角色屬性": "能力値",
        "角色技能": "技能",
        "最近擲骰結果": "最新のダイス結果",
        "傷害結果": "ダメージ結果",
        "任務": "クエスト",
        "安全提醒：": "セキュリティ注意：",
        "JavaScript 插件擁有與編輯器相同的權限，能讀寫專案、介面與瀏覽器儲存。只安裝你信任的作者所提供的檔案。": "JavaScriptプラグインはエディターと同じ権限を持ち、プロジェクト、画面、ブラウザ保存領域へアクセスできます。信頼できる作者のファイルだけをインストールしてください。",
        "尚未安裝外部插件。核心功能不受影響。": "外部プラグインはまだインストールされていません。コア機能には影響ありません。"
      }
    };
    Object.assign(dictionary.en, tutorialDictionary.en);
    Object.assign(dictionary.ja, tutorialDictionary.ja);

    const demoDictionary = {
      en: {
        "讀者進入這個頁面。\n→ 物品加入「攜帶物品」。\n→ 畫面提示取得物品。\n→ 等待這件物品的選項可以出現。": "The reader enters this page.\n→ The item is added to Inventory.\n→ A gain-item notification appears.\n→ Choices waiting for this item can now appear.",
        "讀者進入這個頁面。\n→ 指定物品從攜帶物品移除。\n→ 畫面提示失去物品。\n→ 要求持有它的選項再次隱藏。": "The reader enters this page.\n→ The specified item is removed from Inventory.\n→ A lose-item notification appears.\n→ Choices requiring that item become hidden again.",
        "系統檢查攜帶物品。\n→ 有指定物品：顯示這個選項。\n→ 沒有指定物品：整個選項不出現。\n→ 標籤本身不會顯示給讀者。": "The system checks Inventory.\n→ Item present: show this choice.\n→ Item absent: hide the entire choice.\n→ The condition tag is never shown to the reader.",
        "系統檢查攜帶物品。\n→ 尚未持有：顯示這個選項。\n→ 已經持有：隱藏這個選項。\n→ 適合一次性的尋找物品行動。": "The system checks Inventory.\n→ Not owned: show this choice.\n→ Already owned: hide this choice.\n→ Useful for one-time item searches.",
        "讀者進入這個頁面。\n→ 系統記下這件事情曾經發生。\n→ 事件加入冒險紀錄。\n→ 等待這面旗幟的選項可以出現。": "The reader enters this page.\n→ The system records that the event happened.\n→ It is added to Event History.\n→ Choices waiting for this flag can now appear.",
        "讀者進入這個頁面。\n→ 指定事件旗幟被移除。\n→ 依賴這面旗幟的選項再次隱藏。\n→ 可表現事件重置或狀態解除。": "The reader enters this page.\n→ The specified event flag is removed.\n→ Choices depending on it become hidden again.\n→ This can represent an event reset or cleared state.",
        "系統查看事件足跡。\n→ 指定事件已發生：顯示選項。\n→ 尚未發生：不透露選項內容。\n→ 讀者只看到標籤後面的文字。": "The system checks Event History.\n→ Event occurred: show the choice.\n→ Not occurred: reveal nothing.\n→ The reader sees only the text after the tag.",
        "系統查看事件足跡。\n→ 事件尚未發生：顯示選項。\n→ 事件已發生：隱藏選項。\n→ 適合只能觸發一次的初次事件。": "The system checks Event History.\n→ Event not yet occurred: show the choice.\n→ Event occurred: hide the choice.\n→ Useful for a first-time event that triggers once.",
        "讀者進入這個頁面。\n→ 指定數值直接設定成新數字。\n→ 原本的數值會被覆蓋。\n→ 冒險紀錄顯示最新結果。": "The reader enters this page.\n→ The specified value is set directly.\n→ Its previous value is overwritten.\n→ Adventure Log shows the latest result.",
        "讀者進入這個頁面。\n→ 讀取目前數值並加上指定數量。\n→ 例如金錢 3＋5。\n→ 最後結果變成 8。": "The reader enters this page.\n→ Read the current value and add the specified amount.\n→ Example: Money 3 + 5.\n→ Final result: 8.",
        "讀者進入這個頁面。\n→ 讀取目前數值並扣除指定數量。\n→ 例如體力 10－2。\n→ 最後結果變成 8。": "The reader enters this page.\n→ Read the current value and subtract the specified amount.\n→ Example: Health 10 − 2.\n→ Final result: 8.",
        "系統比較目前數值與條件。\n→ 條件成立：顯示選項。\n→ 條件不成立：隱藏選項。\n→ 可使用 >、<、>=、<= 或 =。": "The system compares the current value with the condition.\n→ Condition met: show the choice.\n→ Condition not met: hide the choice.\n→ Supports >, <, >=, <=, and =.",
        "讀者進入這個頁面。\n→ 建立或設定一項角色屬性。\n→ 屬性值保持固定，不會被骰子結果覆蓋。\n→ 例如力量會一直維持 14，直到作者再次設定。": "The reader enters this page.\n→ Create or set a character attribute.\n→ Dice results never overwrite it.\n→ Strength remains 14 until the author sets it again.",
        "讀者進入這個頁面。\n→ 為同名角色屬性設定骰子修正值。\n→ 擲該屬性的骰子時自動加入修正。\n→ 例如 1d20 加上力量修正 +2。": "The reader enters this page.\n→ Set a dice modifier for the matching attribute.\n→ Rolls using that attribute add it automatically.\n→ Example: 1d20 plus Strength modifier +2.",
        "系統比較角色屬性與條件。\n→ 屬性值符合：顯示選項。\n→ 屬性不足：隱藏選項。\n→ 擲骰不會改變這項角色屬性。": "The system compares the attribute with the condition.\n→ Attribute qualifies: show the choice.\n→ Attribute too low: hide the choice.\n→ Rolling dice never changes the attribute.",
        "讀者進入頁面。\n→ 建立或設定一項角色技能。\n→ 技能和天生屬性分開保存。\n→ 檢定時使用 技能:名稱 明確指定。": "The reader enters the page.\n→ Create or set a character skill.\n→ Skills are stored separately from attributes.\n→ Use 技能:Name to specify it in a check.",
        "讀者進入頁面。\n→ 為同名技能設定額外修正值。\n→ 使用該技能擲骰時自動加入。\n→ 不會改變技能本身的數值。": "The reader enters the page.\n→ Set an extra modifier for the matching skill.\n→ Rolls using that skill add it automatically.\n→ The skill value itself does not change.",
        "讀者進入頁面。\n→ 系統解析標籤。\n→ 執行後更新閱讀器狀態。": "The reader enters the page.\n→ The system parses the tag.\n→ Reader state updates after execution.",
        "讀者進入這個頁面。\n→ 任務切換到新的文字狀態。\n→ 冒險紀錄更新任務進度。\n→ 狀態名稱可由作者自由決定。": "The reader enters this page.\n→ The quest changes to a new text state.\n→ Adventure Log updates its progress.\n→ The author may freely name states.",
        "系統檢查任務狀態。\n→ 狀態文字完全相同：顯示選項。\n→ 不同或尚未建立：隱藏選項。\n→ 名稱與狀態必須完全一致。": "The system checks quest state.\n→ Exact state match: show the choice.\n→ Different or missing: hide the choice.\n→ Quest name and state must match exactly.",
        "閱讀器生成可點擊的立體骰子。\n→ 點擊後播放翻轉動畫。\n→ 系統計算骰子總和與加值。\n→ 結果存成數值並立即更新分歧。": "The reader creates a clickable dimensional die.\n→ Clicking plays a rolling animation.\n→ The system totals dice and modifiers.\n→ The value is saved and choices update immediately.",
        "系統查看該屬性最近一次的擲骰總結果。\n→ 結果符合條件：顯示選項。\n→ 尚未擲骰或不符合：隱藏選項。\n→ 無屬性骰請使用「無屬性」作為名稱。": "The system checks the latest total rolled for that attribute.\n→ Condition met: show the choice.\n→ No roll or condition failed: hide it.\n→ Use 「無屬性」 as the name for an untyped roll.",
        "讀者點擊骰子。\n→ 系統將骰子總值和指定屬性比較。\n→ <、<=、>、>= 由作者明確指定。\n→ 系統只記錄成功或失敗，不改變屬性。": "The reader clicks the die.\n→ The total is compared with the specified target.\n→ The author explicitly chooses <, <=, >, or >=.\n→ Only success or failure is recorded; the target is unchanged.",
        "系統讀取指定檢定最近一次的結果。\n→ 結果文字相同：顯示這個選項。\n→ 尚未檢定或結果不同：隱藏選項。\n→ 基礎模式只有成功與失敗。": "The system reads the latest result of the named check.\n→ Result text matches: show the choice.\n→ Missing or different: hide the choice.\n→ Basic mode uses only Success and Failure.",
        "讀者進入頁面時載入這條進階門檻。\n→ 擲同名檢定後，系統由上到下尋找第一條符合的等級。\n→ 可用固定數字、目標、目標/2、目標/5 或目標*2。\n→ 若沒有進階門檻符合，仍回到成功或失敗。": "This advanced threshold loads when the page opens.\n→ After the named check, rules are tested from top to bottom.\n→ Use a fixed number, target, target/2, target/5, or target*2.\n→ If none match, the result falls back to Success or Failure.",
        "這條規則把傷害骰連到一個檢定結果。\n→ 結果名稱相同時啟動重擊。\n→ 可選骰數加倍、傷害加倍或最大傷害。\n→ 沒有達成時仍擲普通傷害。": "This rule links a damage roll to a check result.\n→ A matching result activates the critical hit.\n→ Choose double dice, double damage, or maximum damage.\n→ Otherwise, roll normal damage.",
        "閱讀器建立獨立的傷害骰按鈕。\n→ 點擊後逐顆顯示骰值與總傷害。\n→ 傷害不會覆蓋命中檢定或角色屬性。\n→ 可用 [隱藏:傷害:名稱>=數字] 控制選項。": "The reader creates a separate damage-roll button.\n→ Clicking shows each die and total damage.\n→ Damage does not overwrite attack checks or attributes.\n→ Use [隱藏:傷害:名稱>=數字] to control choices.",
        "系統一次擲出整組骰池。\n→ 每一顆分別和門檻比較。\n→ 符合的骰子標示 ✓，其餘標示 ×。\n→ 成功顆數達到需求便記錄為成功。": "The system rolls the whole dice pool.\n→ Each die is compared with the threshold.\n→ Qualifying dice show ✓; others show ×.\n→ Meeting the required count records Success.",
        "讀者進入這個頁面。\n→ 返回歷史被清除。\n→ 本頁不顯示返回按鈕。\n→ 適合不可反悔的重大決定。": "The reader enters this page.\n→ Back history is cleared.\n→ This page has no Back button.\n→ Useful for irreversible major decisions.",
        "讀者進入這個頁面。\n→ 手動存檔功能被停用。\n→ 已有存檔仍然保留。\n→ 適合骰局或不能反覆重試的段落。": "The reader enters this page.\n→ Manual saving is disabled.\n→ Existing saves remain.\n→ Useful for dice scenes or passages that should not be retried.",
        "讀者進入這個頁面。\n→ 系統建立自動存檔點。\n→ 存檔顯示作者設定的名稱。\n→ 讀者可以從存檔面板返回。": "The reader enters this page.\n→ An automatic save point is created.\n→ The save displays the author-defined name.\n→ The reader can return from the save panel.",
        "閱讀器建立指定清單的入口。\n→ 讀者點擊後前往對應清單頁。\n→ 可用於道具、情報、人物或規則頁。": "The reader creates an entry for the named list.\n→ Clicking opens the matching list page.\n→ Useful for items, clues, characters, or rules."
      },
      ja: {
        "讀者進入這個頁面。\n→ 物品加入「攜帶物品」。\n→ 畫面提示取得物品。\n→ 等待這件物品的選項可以出現。": "読者がこのページに入ります。\n→ アイテムが所持品に追加されます。\n→ 取得通知が表示されます。\n→ このアイテムを待つ選択肢が表示可能になります。",
        "讀者進入這個頁面。\n→ 指定物品從攜帶物品移除。\n→ 畫面提示失去物品。\n→ 要求持有它的選項再次隱藏。": "読者がこのページに入ります。\n→ 指定アイテムが所持品から削除されます。\n→ 喪失通知が表示されます。\n→ そのアイテムを必要とする選択肢が再び隠れます。",
        "系統檢查攜帶物品。\n→ 有指定物品：顯示這個選項。\n→ 沒有指定物品：整個選項不出現。\n→ 標籤本身不會顯示給讀者。": "システムが所持品を確認します。\n→ 指定アイテムあり：選択肢を表示。\n→ なし：選択肢全体を非表示。\n→ 条件タグ自体は読者に表示されません。",
        "系統檢查攜帶物品。\n→ 尚未持有：顯示這個選項。\n→ 已經持有：隱藏這個選項。\n→ 適合一次性的尋找物品行動。": "システムが所持品を確認します。\n→ 未所持：選択肢を表示。\n→ 所持済み：選択肢を非表示。\n→ 一度だけのアイテム探索に適しています。",
        "讀者進入這個頁面。\n→ 系統記下這件事情曾經發生。\n→ 事件加入冒險紀錄。\n→ 等待這面旗幟的選項可以出現。": "読者がこのページに入ります。\n→ 出来事が発生済みとして記録されます。\n→ イベント履歴へ追加されます。\n→ このフラグを待つ選択肢が表示可能になります。",
        "讀者進入這個頁面。\n→ 指定事件旗幟被移除。\n→ 依賴這面旗幟的選項再次隱藏。\n→ 可表現事件重置或狀態解除。": "読者がこのページに入ります。\n→ 指定イベントフラグが削除されます。\n→ 依存する選択肢が再び隠れます。\n→ イベントのリセットや状態解除を表現できます。",
        "系統查看事件足跡。\n→ 指定事件已發生：顯示選項。\n→ 尚未發生：不透露選項內容。\n→ 讀者只看到標籤後面的文字。": "システムがイベント履歴を確認します。\n→ 発生済み：選択肢を表示。\n→ 未発生：内容を一切見せません。\n→ 読者にはタグ後方の文字だけが見えます。",
        "系統查看事件足跡。\n→ 事件尚未發生：顯示選項。\n→ 事件已發生：隱藏選項。\n→ 適合只能觸發一次的初次事件。": "システムがイベント履歴を確認します。\n→ 未発生：選択肢を表示。\n→ 発生済み：選択肢を非表示。\n→ 一度だけ起こる初回イベントに適しています。",
        "讀者進入這個頁面。\n→ 指定數值直接設定成新數字。\n→ 原本的數值會被覆蓋。\n→ 冒險紀錄顯示最新結果。": "読者がこのページに入ります。\n→ 指定数値を新しい値へ直接設定します。\n→ 以前の値は上書きされます。\n→ 冒険記録に最新結果が表示されます。",
        "讀者進入這個頁面。\n→ 讀取目前數值並加上指定數量。\n→ 例如金錢 3＋5。\n→ 最後結果變成 8。": "読者がこのページに入ります。\n→ 現在値に指定量を加えます。\n→ 例：所持金 3＋5。\n→ 最終結果は8です。",
        "讀者進入這個頁面。\n→ 讀取目前數值並扣除指定數量。\n→ 例如體力 10－2。\n→ 最後結果變成 8。": "読者がこのページに入ります。\n→ 現在値から指定量を引きます。\n→ 例：体力 10－2。\n→ 最終結果は8です。",
        "系統比較目前數值與條件。\n→ 條件成立：顯示選項。\n→ 條件不成立：隱藏選項。\n→ 可使用 >、<、>=、<= 或 =。": "システムが現在値と条件を比較します。\n→ 条件成立：選択肢を表示。\n→ 不成立：選択肢を非表示。\n→ >、<、>=、<=、= を使用できます。",
        "讀者進入這個頁面。\n→ 建立或設定一項角色屬性。\n→ 屬性值保持固定，不會被骰子結果覆蓋。\n→ 例如力量會一直維持 14，直到作者再次設定。": "読者がこのページに入ります。\n→ キャラクター能力値を作成・設定します。\n→ ダイス結果では上書きされません。\n→ 作者が再設定するまで筋力14を維持します。",
        "讀者進入這個頁面。\n→ 為同名角色屬性設定骰子修正值。\n→ 擲該屬性的骰子時自動加入修正。\n→ 例如 1d20 加上力量修正 +2。": "読者がこのページに入ります。\n→ 同名能力値のダイス修正を設定します。\n→ その能力値のロールへ自動加算されます。\n→ 例：1d20＋筋力修正+2。",
        "系統比較角色屬性與條件。\n→ 屬性值符合：顯示選項。\n→ 屬性不足：隱藏選項。\n→ 擲骰不會改變這項角色屬性。": "システムが能力値と条件を比較します。\n→ 条件を満たす：選択肢を表示。\n→ 不足：選択肢を非表示。\n→ ダイスを振っても能力値は変わりません。",
        "讀者進入頁面。\n→ 建立或設定一項角色技能。\n→ 技能和天生屬性分開保存。\n→ 檢定時使用 技能:名稱 明確指定。": "読者がページに入ります。\n→ キャラクター技能を作成・設定します。\n→ 技能は能力値と別に保存されます。\n→ 判定では 技能:名前 を明示します。",
        "讀者進入頁面。\n→ 為同名技能設定額外修正值。\n→ 使用該技能擲骰時自動加入。\n→ 不會改變技能本身的數值。": "読者がページに入ります。\n→ 同名技能の追加修正を設定します。\n→ その技能のロールへ自動加算されます。\n→ 技能値そのものは変わりません。",
        "讀者進入頁面。\n→ 系統解析標籤。\n→ 執行後更新閱讀器狀態。": "読者がページに入ります。\n→ システムがタグを解析します。\n→ 実行後にリーダー状態を更新します。",
        "讀者進入這個頁面。\n→ 任務切換到新的文字狀態。\n→ 冒險紀錄更新任務進度。\n→ 狀態名稱可由作者自由決定。": "読者がこのページに入ります。\n→ クエストが新しい文字状態へ変化します。\n→ 冒険記録の進行度が更新されます。\n→ 状態名は作者が自由に決められます。",
        "系統檢查任務狀態。\n→ 狀態文字完全相同：顯示選項。\n→ 不同或尚未建立：隱藏選項。\n→ 名稱與狀態必須完全一致。": "システムがクエスト状態を確認します。\n→ 完全一致：選択肢を表示。\n→ 異なる・未作成：選択肢を非表示。\n→ 名前と状態は完全一致が必要です。",
        "閱讀器生成可點擊的立體骰子。\n→ 點擊後播放翻轉動畫。\n→ 系統計算骰子總和與加值。\n→ 結果存成數值並立即更新分歧。": "リーダーがクリック可能な立体ダイスを作ります。\n→ クリックで回転演出を再生。\n→ ダイス合計と修正を計算。\n→ 結果を保存し、分岐を即時更新します。",
        "系統查看該屬性最近一次的擲骰總結果。\n→ 結果符合條件：顯示選項。\n→ 尚未擲骰或不符合：隱藏選項。\n→ 無屬性骰請使用「無屬性」作為名稱。": "システムがその能力値の最新ロール合計を確認します。\n→ 条件成立：選択肢を表示。\n→ 未ロール・不成立：非表示。\n→ 能力値なしのダイス名には「無屬性」を使用します。",
        "讀者點擊骰子。\n→ 系統將骰子總值和指定屬性比較。\n→ <、<=、>、>= 由作者明確指定。\n→ 系統只記錄成功或失敗，不改變屬性。": "読者がダイスをクリックします。\n→ 合計を指定対象と比較します。\n→ <、<=、>、>= は作者が指定します。\n→ 成功・失敗だけを記録し、対象値は変えません。",
        "系統讀取指定檢定最近一次的結果。\n→ 結果文字相同：顯示這個選項。\n→ 尚未檢定或結果不同：隱藏選項。\n→ 基礎模式只有成功與失敗。": "システムが指定判定の最新結果を読みます。\n→ 結果文字が一致：選択肢を表示。\n→ 未判定・不一致：非表示。\n→ 基本モードは成功と失敗のみです。",
        "讀者進入頁面時載入這條進階門檻。\n→ 擲同名檢定後，系統由上到下尋找第一條符合的等級。\n→ 可用固定數字、目標、目標/2、目標/5 或目標*2。\n→ 若沒有進階門檻符合，仍回到成功或失敗。": "ページ進入時に上級しきい値を読み込みます。\n→ 同名判定後、上から最初に一致するレベルを探します。\n→ 固定値、目標、目標/2、目標/5、目標*2を使用できます。\n→ 一致しなければ成功・失敗へ戻ります。",
        "這條規則把傷害骰連到一個檢定結果。\n→ 結果名稱相同時啟動重擊。\n→ 可選骰數加倍、傷害加倍或最大傷害。\n→ 沒有達成時仍擲普通傷害。": "この規則はダメージロールを判定結果へ接続します。\n→ 結果名一致でクリティカルを有効化。\n→ ダイス数2倍、ダメージ2倍、最大ダメージを選択。\n→ 未達成なら通常ダメージです。",
        "閱讀器建立獨立的傷害骰按鈕。\n→ 點擊後逐顆顯示骰值與總傷害。\n→ 傷害不會覆蓋命中檢定或角色屬性。\n→ 可用 [隱藏:傷害:名稱>=數字] 控制選項。": "リーダーが独立したダメージボタンを作ります。\n→ クリックで各出目と合計を表示。\n→ 命中判定や能力値を上書きしません。\n→ [隱藏:傷害:名稱>=數字] で選択肢を制御できます。",
        "系統一次擲出整組骰池。\n→ 每一顆分別和門檻比較。\n→ 符合的骰子標示 ✓，其餘標示 ×。\n→ 成功顆數達到需求便記錄為成功。": "システムがダイスプール全体を振ります。\n→ 各ダイスをしきい値と比較。\n→ 成功ダイスは✓、それ以外は×。\n→ 必要成功数に達すると成功を記録します。",
        "讀者進入這個頁面。\n→ 返回歷史被清除。\n→ 本頁不顯示返回按鈕。\n→ 適合不可反悔的重大決定。": "読者がこのページに入ります。\n→ 戻る履歴を消去します。\n→ このページでは戻るボタンを表示しません。\n→ 取り消せない重要な決断向けです。",
        "讀者進入這個頁面。\n→ 手動存檔功能被停用。\n→ 已有存檔仍然保留。\n→ 適合骰局或不能反覆重試的段落。": "読者がこのページに入ります。\n→ 手動セーブを無効化します。\n→ 既存セーブは残ります。\n→ ダイス場面や再試行不可の章向けです。",
        "讀者進入這個頁面。\n→ 系統建立自動存檔點。\n→ 存檔顯示作者設定的名稱。\n→ 讀者可以從存檔面板返回。": "読者がこのページに入ります。\n→ 自動セーブポイントを作成します。\n→ 作者が設定した名前を表示します。\n→ セーブパネルから戻れます。",
        "閱讀器建立指定清單的入口。\n→ 讀者點擊後前往對應清單頁。\n→ 可用於道具、情報、人物或規則頁。": "リーダーが指定リストへの入口を作ります。\n→ クリックで対応リストページへ移動します。\n→ アイテム、情報、人物、ルールページに使用できます。"
      }
    };
    Object.assign(dictionary.en, demoDictionary.en);
    Object.assign(dictionary.ja, demoDictionary.ja);

    const uiSupplement = {
      en: {
        "未開啟專案": "No project open", "輸出 Pixiv": "Export Pixiv", "作品": "Work", "語言": "Language",
        "Chapter設定": "Chapter settings", "章節與語言": "Chapters & language", "進階": "Advanced",
        "剪下": "Cut", "釘成群組": "Pin as group", "解除群組": "Ungroup", "取消選取": "Clear selection",
        "桌布": "Wallpaper", "清除": "Clear", "這個 Node 是": "This node is", "新章節": "New chapter",
        "內文延續": "Continue content", "閱讀與輸出時顯示為章節大標題。": "Displayed as a large chapter heading in the reader and export.",
        "章節標題": "Chapter title", "作者筆記（僅供編輯參考，不會輸出到正文/預覽）": "Author notes (editor reference only; never exported)",
        "指定 Page 編輯器": "Specific-page editor", "請選擇 Page": "Select a page", "編輯內容": "Edit content",
        "Pixiv 正文": "Pixiv content", "HTML 內容": "HTML content", "套用到指定 Page": "Apply to selected page",
        "原始格式": "Source format", "所見即得預覽": "WYSIWYG preview", "正文內容": "Main content",
        "強調": "Emphasis", "圖片": "Image", "連結": "Link", "底線": "Underline", "刪除線": "Strikethrough",
        "引用": "Quote", "清單": "List", "分隔線": "Divider", "章節": "Chapter",
        "新增選項（自動生成新頁面）": "Add choice (automatically creates a page)", "數值變化": "Value change", "任務狀態": "Quest state",
        "Gamebook 標籤：": "Gamebook tags:", "目前 Node 的打字機動畫": "Typewriter settings for current node",
        "標準": "Normal", "輸出閱讀器控制項": "Exported reader controls", "所見即得": "WYSIWYG",
        "HTML 原始碼": "HTML source", "靠左": "Left", "置中": "Center", "靠右": "Right", "左右對齊": "Justify",
        "背景圖片": "Background image", "清除背景圖片": "Clear background image",
        "直接選擇圖片，系統會自動縮放與壓縮。": "Choose an image directly; the system scales and compresses it automatically.",
        "可建立分歧按鈕、動態箭頭或純文字。把滑鼠移到下方 HTML 預覽的元件上，拖曳「✥ 拖曳排版」即可直接定位。": "Create branch buttons, animated arrows, or plain text. Hover an element in the HTML preview and drag “✥ Layout” to position it.",
        "核心頁面排版": "Core page layout", "標題、內文與選項現在共用核心位置、尺寸、樣式和動畫資料。": "Title, content, and choices now share core position, size, style, and animation data.",
        "開啟視覺排版工作室": "Open visual layout studio", "純文字跳頁": "Plain-text page link", "插入純文字": "Insert plain text",
        "HTML 選項呈現": "HTML choice appearance", "純文字底線": "Underlined text", "按鈕": "Button", "卡片": "Card",
        "HTML 預覽": "HTML preview", "原始碼": "Source", "可直接編輯 HTML 與 Pixiv 標記": "Edit HTML and Pixiv markup directly",
        "進階操作": "Advanced operations", "刪除此頁面": "Delete this page", "Pixiv預覽": "Pixiv preview",
        "Chapter 樣式設定": "Chapter style settings", "套用": "Apply", "字母組合": "Letter combinations", "產生排列": "Generate permutations",
        "節點快速搜尋": "Quick node search", "（可再拖到畫布上釘選，就像貼在虛擬桌布上）": "(Drag onto the canvas to pin it like a note on a virtual desk.)",
        "細": "Thin", "中": "Medium", "粗": "Thick", "橡皮擦": "Eraser", "復原": "Undo", "清空": "Clear all", "完成": "Done", "自訂": "Custom",
        "Pixiv 小說專案": "Pixiv novel projects", "管理作品、版本與本機專案庫": "Manage works, versions, and the local project library",
        "建立作品": "Create work", "建立專案": "Create project", "專案庫": "Project library", "所有作品": "All works", "目前開啟": "Currently open",
        "匯入 JSON": "Import JSON", "返回作品清單": "Back to works", "頁面": "Pages", "Pixiv 字數": "Pixiv character count",
        "作品名稱": "Work title", "儲存": "Save", "開啟作品": "Open work", "建立副本": "Duplicate", "匯出 JSON": "Export JSON", "刪除作品": "Delete work",
        "IndexedDB 本機資料庫總管": "IndexedDB local database inspector", "此處只提供唯讀盤查，不會刪除資料。": "Read-only inspection only; no data is deleted.",
        "匯出盤查報告": "Export inspection report", "還原自動備份": "Restore automatic backup", "重做": "Redo",
        "輸出Pixiv小說預覽": "Export Pixiv novel preview", "本機資料庫": "Local database", "開啟或新增專案以開始": "Open or create a project to begin",
        "▶ 看運作": "▶ See how it works", "看運作": "See how it works", "官方多語言介面包已啟用": "Official language pack enabled",
        "很有靈感 (1天)": "Inspired (1 day)", "•清單": "• List", "1.清單": "1. List", "已複製": "Copied"
      },
      ja: {
        "未開啟專案": "プロジェクト未選択", "輸出 Pixiv": "Pixivへ出力", "作品": "作品", "語言": "言語",
        "Chapter設定": "チャプター設定", "章節與語言": "チャプターと言語", "進階": "詳細",
        "剪下": "切り取り", "釘成群組": "グループとして固定", "解除群組": "グループ解除", "取消選取": "選択解除",
        "桌布": "壁紙", "清除": "クリア", "這個 Node 是": "このNodeは", "新章節": "新しいチャプター",
        "內文延續": "本文を継続", "閱讀與輸出時顯示為章節大標題。": "リーダーと出力では大きなチャプター見出しとして表示されます。",
        "章節標題": "チャプター見出し", "作者筆記（僅供編輯參考，不會輸出到正文/預覽）": "作者メモ（編集用。本文やプレビューには出力されません）",
        "指定 Page 編輯器": "指定ページエディター", "請選擇 Page": "ページを選択", "編輯內容": "内容を編集",
        "Pixiv 正文": "Pixiv本文", "HTML 內容": "HTML内容", "套用到指定 Page": "指定ページへ適用",
        "原始格式": "ソース形式", "所見即得預覽": "WYSIWYGプレビュー", "正文內容": "本文内容",
        "強調": "強調", "圖片": "画像", "連結": "リンク", "底線": "下線", "刪除線": "取り消し線",
        "引用": "引用", "清單": "リスト", "分隔線": "区切り線", "章節": "チャプター",
        "新增選項（自動生成新頁面）": "選択肢を追加（新ページを自動作成）", "數值變化": "数値変化", "任務狀態": "クエスト状態",
        "Gamebook 標籤：": "Gamebookタグ：", "目前 Node 的打字機動畫": "現在のNodeのタイプ演出",
        "標準": "標準", "輸出閱讀器控制項": "出力リーダー操作", "所見即得": "WYSIWYG",
        "HTML 原始碼": "HTMLソース", "靠左": "左寄せ", "置中": "中央", "靠右": "右寄せ", "左右對齊": "両端揃え",
        "背景圖片": "背景画像", "清除背景圖片": "背景画像を消去",
        "直接選擇圖片，系統會自動縮放與壓縮。": "画像を直接選択すると、自動的に縮小・圧縮されます。",
        "可建立分歧按鈕、動態箭頭或純文字。把滑鼠移到下方 HTML 預覽的元件上，拖曳「✥ 拖曳排版」即可直接定位。": "分岐ボタン、動く矢印、プレーンテキストを作成できます。HTMLプレビュー上の要素へカーソルを置き、「✥ レイアウト」をドラッグして配置します。",
        "核心頁面排版": "コアページレイアウト", "標題、內文與選項現在共用核心位置、尺寸、樣式和動畫資料。": "見出し、本文、選択肢は位置、サイズ、スタイル、アニメーションデータを共有します。",
        "開啟視覺排版工作室": "ビジュアルレイアウトを開く", "純文字跳頁": "プレーンテキスト移動", "插入純文字": "プレーンテキストを挿入",
        "HTML 選項呈現": "HTML選択肢表示", "純文字底線": "下線テキスト", "按鈕": "ボタン", "卡片": "カード",
        "HTML 預覽": "HTMLプレビュー", "原始碼": "ソース", "可直接編輯 HTML 與 Pixiv 標記": "HTMLとPixivマークアップを直接編集できます",
        "進階操作": "詳細操作", "刪除此頁面": "このページを削除", "Pixiv預覽": "Pixivプレビュー",
        "Chapter 樣式設定": "チャプタースタイル設定", "套用": "適用", "字母組合": "文字組み合わせ", "產生排列": "順列を生成",
        "節點快速搜尋": "Nodeクイック検索", "（可再拖到畫布上釘選，就像貼在虛擬桌布上）": "（キャンバスへドラッグして、仮想デスク上のメモのように固定できます）",
        "細": "細", "中": "中", "粗": "太", "橡皮擦": "消しゴム", "復原": "元に戻す", "清空": "すべて消去", "完成": "完了", "自訂": "カスタム",
        "Pixiv 小說專案": "Pixiv小説プロジェクト", "管理作品、版本與本機專案庫": "作品、バージョン、ローカルプロジェクトを管理",
        "建立作品": "作品を作成", "建立專案": "プロジェクトを作成", "專案庫": "プロジェクトライブラリ", "所有作品": "すべての作品", "目前開啟": "現在開いている作品",
        "匯入 JSON": "JSONを読み込む", "返回作品清單": "作品一覧へ戻る", "頁面": "ページ", "Pixiv 字數": "Pixiv文字数",
        "作品名稱": "作品名", "儲存": "保存", "開啟作品": "作品を開く", "建立副本": "複製を作成", "匯出 JSON": "JSONを書き出す", "刪除作品": "作品を削除",
        "IndexedDB 本機資料庫總管": "IndexedDBローカルデータベース確認", "此處只提供唯讀盤查，不會刪除資料。": "読み取り専用の確認画面です。データは削除されません。",
        "匯出盤查報告": "確認レポートを書き出す", "還原自動備份": "自動バックアップを復元", "重做": "やり直す",
        "輸出Pixiv小說預覽": "Pixiv小説プレビューを出力", "本機資料庫": "ローカルデータベース", "開啟或新增專案以開始": "プロジェクトを開くか作成してください",
        "▶ 看運作": "▶ 動作を見る", "看運作": "動作を見る", "官方多語言介面包已啟用": "公式多言語パックが有効になりました",
        "很有靈感 (1天)": "ひらめきあり（1日）", "•清單": "• リスト", "1.清單": "1. リスト", "已複製": "コピーしました"
      }
    };
    Object.assign(dictionary.en, uiSupplement.en);
    Object.assign(dictionary.ja, uiSupplement.ja);

    const dialogDictionary = {
      en: {
        "瀏覽器阻擋了測試閱讀視窗，請允許此頁開啟新視窗。": "The browser blocked the test-reader window. Allow this page to open pop-ups.",
        "請先開啟「排版測試框」，完成邊界驗證後再輸出。": "Open Layout Studio and complete boundary validation before exporting.",
        "請複製標籤：": "Copy this tag:",
        "讀者進入這一頁時取得什麼物品？": "Which item does the reader gain on entering this page?",
        "讀者進入這一頁時，要記錄哪件事？": "Which event should be recorded when the reader enters this page?",
        "讀者進入這一頁時，要取消哪個事件旗幟？": "Which event flag should be cleared on entering this page?",
        "讀者進入這一頁時，要失去哪個物品？": "Which item does the reader lose on entering this page?",
        "輸入數值標籤。可用：數值:體力=10、增加:體力:2、減少:體力:1": "Enter a value tag. Examples: 數值:體力=10, 增加:體力:2, 減少:體力:1",
        "設定角色屬性或修正值。\n例如：屬性:力量=14、修正值:力量=2": "Set a character attribute or modifier.\nExamples: 屬性:力量=14, 修正值:力量=2",
        "設定角色技能或技能修正值。\n例如：技能:開鎖=60、技能修正值:開鎖=5": "Set a character skill or skill modifier.\nExamples: 技能:開鎖=60, 技能修正值:開鎖=5",
        "輸入「任務名稱:狀態」，例如：尋找公主:進行中": "Enter QuestName:State, for example: 尋找公主:進行中",
        "替這次檢定命名（選項條件會使用這個名稱）：": "Name this check (choice conditions will use this name):",
        "骰式，例如 1d100、1d20 或 2d6+2：": "Dice formula, such as 1d100, 1d20, or 2d6+2:",
        "骰式格式不正確。例：1d100": "Invalid dice formula. Example: 1d100",
        "比較方式可輸入 <、<=、=、> 或 >=：": "Comparison operator: <, <=, =, >, or >=:",
        "比較方式必須是 <、<=、=、> 或 >=。": "The comparison operator must be <, <=, =, >, or >=.",
        "比較目標請明確輸入「技能:名稱」或「屬性:名稱」。\n例如：技能:開鎖、屬性:力量": "Enter an explicit target using 技能:Name or 屬性:Name.\nExamples: 技能:開鎖, 屬性:力量",
        "要替哪一個檢定增加成功等級？名稱必須和 [檢定:名稱:…] 相同。": "Which check receives this result level? Its name must match [檢定:Name:…].",
        "這個結果等級叫什麼？": "What is this result level called?",
        "門檻可填固定數字、目標、目標/2、目標/5、目標*2、目標+2 或目標-2：": "Threshold: fixed number, target, target/2, target/5, target*2, target+2, or target-2:",
        "要替哪一個檢定增加自然骰等級？": "Which check receives this natural-roll level?",
        "這個自然骰結果叫什麼？": "What is this natural-roll result called?",
        "直接輸入自然骰條件，例如 =20、=1、>=19：": "Enter a natural-roll condition, such as =20, =1, or >=19:",
        "自然骰條件格式不正確。例：=20": "Invalid natural-roll condition. Example: =20",
        "傷害骰名稱，例如武器或招式名稱：": "Damage-roll name, such as a weapon or technique:",
        "傷害骰式，例如 1d8+2、2d6 或 1d10-1：": "Damage formula, such as 1d8+2, 2d6, or 1d10-1:",
        "傷害骰式格式不正確。例：1d8+2": "Invalid damage formula. Example: 1d8+2",
        "要套用重擊的傷害骰名稱：": "Name of the damage roll that uses this critical rule:",
        "依據哪一個檢定名稱？": "Which check name determines it?",
        "該檢定達到哪個結果時啟動？": "Which check result activates it?",
        "重擊方式只能輸入：骰數加倍、傷害加倍、最大傷害": "Critical mode: 骰數加倍, 傷害加倍, or 最大傷害",
        "重擊方式必須是：骰數加倍、傷害加倍或最大傷害。": "Critical mode must be 骰數加倍, 傷害加倍, or 最大傷害.",
        "成功骰池名稱：": "Success-pool name:", "骰池，例如 5d6、8d10：": "Dice pool, such as 5d6 or 8d10:",
        "骰池格式不正確。例：5d6": "Invalid dice-pool formula. Example: 5d6",
        "每一顆骰子怎樣算成功？例如 >=5、<=2：": "When does each die count as a success? Examples: >=5 or <=2:",
        "單骰門檻格式不正確。例：>=5": "Invalid per-die threshold. Example: >=5",
        "整組骰池至少需要幾個成功？": "How many successes does the pool require?",
        "請輸入隱藏條件。": "Enter a choice condition.", "已複製標籤：": "Tag copied:",
        "請複製並貼到選項文字前方：": "Copy and paste this at the start of the choice text:",
        "清單名稱（例如：道具清單、情報、角色資料）": "List name (for example: Items, Clues, Characters)",
        "命運骰的行動名稱：": "Fate action name:", "輸入 1 使用技能、2 使用屬性、3 不加值、4 建立固定難度檢定：": "Enter 1 for a skill, 2 for an attribute, 3 for no bonus, or 4 for a fixed-difficulty check:",
        "目標來源輸入「技能」或「屬性」：": "Enter 技能 or 屬性 as the target source:", "技能或屬性名稱：": "Skill or attribute name:", "固定難度：": "Fixed difficulty:"
      },
      ja: {
        "瀏覽器阻擋了測試閱讀視窗，請允許此頁開啟新視窗。": "ブラウザーがテストリーダーをブロックしました。このページのポップアップを許可してください。",
        "請先開啟「排版測試框」，完成邊界驗證後再輸出。": "レイアウトスタジオを開き、境界検証を完了してから出力してください。",
        "請複製標籤：": "タグをコピー：", "讀者進入這一頁時取得什麼物品？": "このページに入った時に取得するアイテムは？",
        "讀者進入這一頁時，要記錄哪件事？": "このページに入った時に記録するイベントは？", "讀者進入這一頁時，要取消哪個事件旗幟？": "解除するイベントフラグは？",
        "讀者進入這一頁時，要失去哪個物品？": "このページに入った時に失うアイテムは？",
        "輸入數值標籤。可用：數值:體力=10、增加:體力:2、減少:體力:1": "数値タグを入力。例：數值:體力=10、增加:體力:2、減少:體力:1",
        "設定角色屬性或修正值。\n例如：屬性:力量=14、修正值:力量=2": "能力値または修正値を設定。\n例：屬性:力量=14、修正值:力量=2",
        "設定角色技能或技能修正值。\n例如：技能:開鎖=60、技能修正值:開鎖=5": "技能または技能修正値を設定。\n例：技能:開鎖=60、技能修正值:開鎖=5",
        "輸入「任務名稱:狀態」，例如：尋找公主:進行中": "「クエスト名:状態」を入力。例：尋找公主:進行中",
        "替這次檢定命名（選項條件會使用這個名稱）：": "この判定の名前（選択肢条件で使用）：", "骰式，例如 1d100、1d20 或 2d6+2：": "ダイス式（例：1d100、1d20、2d6+2）：",
        "骰式格式不正確。例：1d100": "ダイス式が正しくありません。例：1d100", "比較方式可輸入 <、<=、=、> 或 >=：": "比較演算子 <、<=、=、>、>=：",
        "比較方式必須是 <、<=、=、> 或 >=。": "比較演算子は <、<=、=、>、>= のいずれかです。",
        "比較目標請明確輸入「技能:名稱」或「屬性:名稱」。\n例如：技能:開鎖、屬性:力量": "対象を 技能:名前 または 屬性:名前 で指定。\n例：技能:開鎖、屬性:力量",
        "要替哪一個檢定增加成功等級？名稱必須和 [檢定:名稱:…] 相同。": "どの判定に結果レベルを追加しますか？名前は [檢定:名前:…] と一致させます。",
        "這個結果等級叫什麼？": "結果レベルの名前は？", "門檻可填固定數字、目標、目標/2、目標/5、目標*2、目標+2 或目標-2：": "しきい値：固定値、目標、目標/2、目標/5、目標*2、目標+2、目標-2：",
        "要替哪一個檢定增加自然骰等級？": "どの判定にナチュラルロールレベルを追加しますか？", "這個自然骰結果叫什麼？": "ナチュラルロール結果の名前は？",
        "直接輸入自然骰條件，例如 =20、=1、>=19：": "ナチュラル条件を入力（例：=20、=1、>=19）：", "自然骰條件格式不正確。例：=20": "ナチュラル条件が正しくありません。例：=20",
        "傷害骰名稱，例如武器或招式名稱：": "ダメージロール名（武器や技など）：", "傷害骰式，例如 1d8+2、2d6 或 1d10-1：": "ダメージ式（例：1d8+2、2d6、1d10-1）：",
        "傷害骰式格式不正確。例：1d8+2": "ダメージ式が正しくありません。例：1d8+2", "要套用重擊的傷害骰名稱：": "クリティカルを適用するダメージ名：",
        "依據哪一個檢定名稱？": "参照する判定名は？", "該檢定達到哪個結果時啟動？": "どの判定結果で有効化しますか？",
        "重擊方式只能輸入：骰數加倍、傷害加倍、最大傷害": "クリティカル方式：骰數加倍、傷害加倍、最大傷害", "重擊方式必須是：骰數加倍、傷害加倍或最大傷害。": "クリティカル方式は 骰數加倍、傷害加倍、最大傷害 のいずれかです。",
        "成功骰池名稱：": "成功ダイスプール名：", "骰池，例如 5d6、8d10：": "ダイスプール（例：5d6、8d10）：", "骰池格式不正確。例：5d6": "ダイスプール式が正しくありません。例：5d6",
        "每一顆骰子怎樣算成功？例如 >=5、<=2：": "各ダイスの成功条件（例：>=5、<=2）：", "單骰門檻格式不正確。例：>=5": "単一ダイス条件が正しくありません。例：>=5",
        "整組骰池至少需要幾個成功？": "ダイスプールに必要な成功数は？", "請輸入隱藏條件。": "選択肢条件を入力。", "已複製標籤：": "タグをコピーしました：",
        "請複製並貼到選項文字前方：": "選択肢テキストの先頭へコピー＆貼り付け：", "清單名稱（例如：道具清單、情報、角色資料）": "リスト名（例：アイテム、情報、キャラクター）",
        "命運骰的行動名稱：": "Fateアクション名：", "輸入 1 使用技能、2 使用屬性、3 不加值、4 建立固定難度檢定：": "1=技能、2=能力値、3=ボーナスなし、4=固定難易度判定：",
        "目標來源輸入「技能」或「屬性」：": "対象種別として「技能」または「屬性」を入力：", "技能或屬性名稱：": "技能または能力値名：", "固定難度：": "固定難易度："
      }
    };
    Object.assign(dictionary.en, dialogDictionary.en);
    Object.assign(dictionary.ja, dialogDictionary.ja);

    let language = localStorage.getItem(STORAGE_KEY) || "zh-TW";
    if (!SUPPORTED.includes(language)) language = "zh-TW";
    let observer = null;
    let translating = false;

    const protectedSelector = [
      "textarea",
      "input:not([type='button']):not([type='submit'])",
      "[contenteditable='true']",
      "#flowCanvas",
      ".node",
      ".node-card",
      ".pixiv-integrated-preview",
      "#htmlIntegratedPreview",
      ".rls-stage",
      ".gtg-example code",
      "[data-plugin-source]"
    ].join(",");

    function isProtected(element) {
      return Boolean(element && element.closest && element.closest(protectedSelector));
    }

    function remember(element, attribute, value) {
      const key = "i18nOriginal" + attribute[0].toUpperCase() + attribute.slice(1);
      if (!(key in element.dataset)) element.dataset[key] = value;
      return element.dataset[key];
    }

    function translated(source) {
      if (language === "zh-TW") return source;
      const table = dictionary[language] || {};
      if (table[source]) return table[source];

      // 保留按鈕前面的 emoji／圖示，只翻譯第一個空格後的介面文字。
      const separator = source.indexOf(" ");
      if (separator > 0) {
        const prefix = source.slice(0, separator + 1);
        const label = source.slice(separator + 1);
        if (table[label]) return prefix + table[label];
      }

      const pageNumber = source.match(/^（第\s*(\d+)\s*頁）$/);
      if (pageNumber) return language === "en" ? `(Page ${pageNumber[1]})` : `（${pageNumber[1]}ページ）`;

      return source;
    }

    function translateElement(element) {
      if (!element || element.nodeType !== 1 || isProtected(element)) return;

      const canReplaceText = element.children.length === 0 &&
        /^(BUTTON|LABEL|SUMMARY|OPTION|H1|H2|H3|H4|STRONG|SPAN|A|OUTPUT|P|LI|SMALL|TH|TD|LEGEND)$/.test(element.tagName);

      if (canReplaceText) {
        const current = element.textContent;
        const trimmed = current.trim();
        if (trimmed) {
          const original = remember(element, "text", trimmed);
          const next = translated(original);
          const leading = current.match(/^\s*/)[0];
          const trailing = current.match(/\s*$/)[0];
          element.textContent = leading + next + trailing;
        }
      }

      ["title", "aria-label", "placeholder"].forEach(attribute => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute);
        const original = remember(element, attribute.replace("-", "_"), current);
        element.setAttribute(attribute, translated(original));
      });

      if (element.hasAttribute("data-demo")) {
        const current = element.getAttribute("data-demo");
        const original = remember(element, "demo", current);
        element.setAttribute("data-demo", translated(original));
      }
    }

    function applyLanguage(root) {
      if (translating) return;
      translating = true;
      if (observer) observer.disconnect();

      const base = root && root.nodeType === 1 ? root : document.body;
      translateElement(base);
      base.querySelectorAll("button,label,summary,option,h1,h2,h3,h4,strong,span,a,output,p,li,small,th,td,legend,[title],[aria-label],[placeholder],[data-demo]")
        .forEach(translateElement);

      document.documentElement.lang = language;
      translating = false;
      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    }

    function setLanguage(next) {
      language = SUPPORTED.includes(next) ? next : "zh-TW";
      localStorage.setItem(STORAGE_KEY, language);
      document.querySelectorAll("[data-firehaha-language]").forEach(select => {
        select.value = language;
      });
      applyLanguage(document.body);
      api.emit("firehaha:language-changed", { language });
    }

    const nativeDialogs = {
      alert: window.alert.bind(window),
      confirm: window.confirm.bind(window),
      prompt: window.prompt.bind(window)
    };

    function translateDialogMessage(message) {
      const source = String(message == null ? "" : message);
      const exact = translated(source);
      if (exact !== source || language === "zh-TW") return exact;

      const table = dictionary[language] || {};
      let output = source;
      Object.keys(table)
        .filter(key => key.length >= 4 && output.includes(key))
        .sort((a, b) => b.length - a.length)
        .forEach(key => { output = output.split(key).join(table[key]); });
      return output;
    }

    const localizedAlert = message => nativeDialogs.alert(translateDialogMessage(message));
    const localizedConfirm = message => nativeDialogs.confirm(translateDialogMessage(message));
    const localizedPrompt = (message, defaultValue) => nativeDialogs.prompt(translateDialogMessage(message), defaultValue);
    window.alert = localizedAlert;
    window.confirm = localizedConfirm;
    window.prompt = localizedPrompt;

    const removeEditorStyle = api.addStyle("language-switcher", `
      .firehaha-language-switcher {
        position: fixed;
        top: 12px;
        right: 170px;
        z-index: 2147481900;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border: 1px solid #9eb8cb;
        border-radius: 10px;
        background: rgba(255,255,255,.94);
        box-shadow: 0 4px 15px rgba(30,60,80,.14);
        font: 700 12px/1.2 system-ui, sans-serif;
      }
      .firehaha-language-switcher select {
        min-height: 30px;
        border: 1px solid #aac0d0;
        border-radius: 7px;
        background: #fff;
      }
      @media (max-width: 700px) {
        .firehaha-language-switcher {
          top: auto;
          right: 10px;
          bottom: 128px;
        }
      }
    `);

    const switcher = document.createElement("label");
    switcher.className = "firehaha-language-switcher";
    switcher.innerHTML = `
      <span aria-hidden="true">🌐</span>
      <select data-firehaha-language aria-label="介面語言">
        <option value="zh-TW">繁體中文</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
      </select>
    `;
    document.body.appendChild(switcher);
    switcher.querySelector("select").value = language;
    switcher.querySelector("select").addEventListener("change", event => {
      setLanguage(event.target.value);
    });

    observer = new MutationObserver(records => {
      const roots = [];
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) roots.push(node);
      }));
      if (!roots.length) return;
      requestAnimationFrame(() => roots.forEach(applyLanguage));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const readerDictionary = {
      en: dictionary.en,
      ja: dictionary.ja
    };

    const removeReaderTransform = api.registerReaderTransform(
      "reader-language",
      function addReaderLanguage(html) {
        const runtime = `
          <script id="firehaha-reader-language-runtime">
          (function(){
            const dictionaries=${JSON.stringify(readerDictionary)};
            const supported=["zh-TW","en","ja"];
            const storageKey="firehaha.reader.language";
            let language=localStorage.getItem(storageKey)||${JSON.stringify(language)};
            if(!supported.includes(language))language="zh-TW";
            function translate(root){
              const dict=dictionaries[language]||{};
              const translated=source=>{if(language==="zh-TW")return source;if(dict[source])return dict[source];const separator=source.indexOf(" ");if(separator>0){const prefix=source.slice(0,separator+1),label=source.slice(separator+1);if(dict[label])return prefix+dict[label]}return source};
              const elements=[root,...root.querySelectorAll("button,label,summary,option,strong,span,a,output,p,li,small,h1,h2,h3,h4,[title],[aria-label]")];
              elements.forEach(element=>{
                if(!element||element.closest(".content,.choices,.story-chip"))return;
                if(element.children.length===0){
                  const current=element.textContent,trimmed=current.trim();
                  if(trimmed){if(!element.dataset.i18nOriginalText)element.dataset.i18nOriginalText=trimmed;const source=element.dataset.i18nOriginalText;element.textContent=current.match(/^\\s*/)[0]+translated(source)+current.match(/\\s*$/)[0]}
                }
              });
              document.documentElement.lang=language;
            }
            const label=document.createElement("label");label.className="reader-language-switcher";label.innerHTML='<span aria-hidden="true">🌐</span><select aria-label="介面語言"><option value="zh-TW">繁體中文</option><option value="en">English</option><option value="ja">日本語</option></select>';document.body.appendChild(label);const select=label.querySelector("select");select.value=language;select.onchange=()=>{language=select.value;localStorage.setItem(storageKey,language);translate(document.body)};
            const observer=new MutationObserver(()=>requestAnimationFrame(()=>translate(document.body)));observer.observe(document.body,{childList:true,subtree:true});translate(document.body);
          })();
          <\/script>
        `;
        const style = `
          <style id="firehaha-reader-language-style">
            .reader-language-switcher{position:fixed;right:12px;top:12px;z-index:10020;display:inline-flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #aab8c3;border-radius:9px;background:rgba(255,255,255,.92);font:700 11px/1.2 system-ui}.reader-language-switcher select{min-height:28px;border:1px solid #b8c5ce;border-radius:6px;background:#fff}.reader-dark .reader-language-switcher{background:rgba(28,39,50,.94);color:#fff}.reader-dark .reader-language-switcher select{background:#263746;color:#fff}@media(max-width:620px){.reader-language-switcher{top:58px}}
          </style>
        `;
        return html
          .replace("</head>", style + "</head>")
          .replace("</body>", runtime + "</body>");
      },
      150
    );

    applyLanguage(document.body);
    api.toast("官方多語言介面包已啟用");

    return function cleanup() {
      if (observer) observer.disconnect();
      removeReaderTransform();
      removeEditorStyle();
      switcher.remove();
      if (window.alert === localizedAlert) window.alert = nativeDialogs.alert;
      if (window.confirm === localizedConfirm) window.confirm = nativeDialogs.confirm;
      if (window.prompt === localizedPrompt) window.prompt = nativeDialogs.prompt;

      language = "zh-TW";
      document.querySelectorAll("[data-i18n-original-text]").forEach(element => {
        element.textContent = element.dataset.i18nOriginalText;
        delete element.dataset.i18nOriginalText;
      });
      document.documentElement.lang = "zh-TW";
    };
  }
});
