# 画像素材 差し替えガイド

更新日: 2026-09-05  
対象: Gridbound Tactics Prototype 0.1.0

## 1. この資料の目的

仮表示を正式な画像へ差し替える手順をまとめた資料です。画像パスや表示サイズはJSONで管理しているため、基本的に`src/game.js`を変更する必要はありません。

現在、画像を直接差し替えられる対象は次の3種類です。

| 種類 | 保存先 | 設定ファイル | 対応状況 |
| --- | --- | --- | --- |
| 戦闘キャラスプライト | `assets/characters/` | `data/sprites.json` | 対応済み |
| シナリオ立ち絵 | `assets/portraits/` | `data/portraits.json` | 対応済み |
| スキルカットイン | `assets/cutins/` | `data/cutins.json` | 対応済み |

マップタイル、シナリオ背景、UI枠、アイコン、戦闘エフェクトは、現段階では画像差し替え方式になっていません。詳しくは「未対応の画像」を参照してください。

## 2. 共通ルール

- 画像形式はPNGを推奨します。
- 透過が必要な素材はアルファチャンネル付きPNGにします。
- JSON内のパスはプロジェクト直下からの相対パスです。
- ファイル名の大文字・小文字はJSONと一致させます。
- ファイル名は半角英数字、ハイフン、アンダースコアを推奨します。
- 同じファイル名で上書きした場合、ブラウザで`Ctrl + F5`を押して再読み込みします。
- 画像が存在しない、または読込に失敗した場合は仮表示へ自動的に戻ります。

画像フォルダは次の構成です。

```text
tactical-rpg-prototype/
├─ assets/
│  ├─ characters/   戦闘キャラスプライト
│  ├─ portraits/    シナリオ立ち絵
│  └─ cutins/       スキル・魔法カットイン
└─ data/
   ├─ sprites.json
   ├─ portraits.json
   └─ cutins.json
```

## 3. 戦闘キャラスプライト

### 3.1 標準フォーマット

標準設定は、1フレーム`32x32`ピクセル、上下左右4方向のスプライトシートです。

```text
1行目: 下向き
2行目: 左向き
3行目: 右向き
4行目: 上向き
```

現在は各行の待機フレームのみを使用します。標準の`idleFrame`は0なので、一番左の列が表示されます。歩行アニメーションは未実装です。

1列だけで作る場合、画像全体の標準サイズは`32x128`ピクセルです。

```text
┌──────┐
│ DOWN │ 32x32
├──────┤
│ LEFT │ 32x32
├──────┤
│RIGHT │ 32x32
├──────┤
│  UP  │ 32x32
└──────┘
```

### 3.2 表示サイズ

標準では、元画像の`32x32`フレームを戦闘画面上で`42x42`ピクセルとして描画します。

| 設定 | 意味 | 標準値 |
| --- | --- | ---: |
| `frameWidth` | 元画像1フレームの横幅 | 32 |
| `frameHeight` | 元画像1フレームの縦幅 | 32 |
| `drawWidth` | ゲーム画面上の横幅 | 42 |
| `drawHeight` | ゲーム画面上の縦幅 | 42 |
| `idleFrame` | 使用する列番号、左端が0 | 0 |

異なるサイズの素材も使用できます。例えば1フレーム`48x48`なら、対象スプライトの設定だけ変更します。

```json
{
  "path": "assets/characters/nia.png",
  "frameWidth": 48,
  "frameHeight": 48,
  "drawWidth": 46,
  "drawHeight": 46,
  "idleFrame": 0
}
```

### 3.3 既存キャラの差し替え

例としてNiaを差し替える場合:

1. 新しいスプライトシートを`assets/characters/nia.png`へ置きます。
2. ファイル名を変えない場合、JSON編集は不要です。
3. フレームサイズや方向順が異なる場合だけ`data/sprites.json`を変更します。
4. ゲームを起動し、戦闘画面で上下左右の向きを確認します。

現在設定されているファイル名:

| ID | ファイル | 対象 |
| --- | --- | --- |
| `rook` | `rook.png` | Rook |
| `nia` | `nia.png` | Nia |
| `mira` | `mira.png` | Mira |
| `raider` | `raider.png` | Raider / Iron Vossの戦闘表示 |
| `cutpurse` | `cutpurse.png` | Cutpurse |
| `ash_shaman` | `ash_shaman.png` | Ash Shaman / Gloom Acolyte |
| `raider_crimson` | `raider_crimson.png` | Crimson Raider |
| `raider_iron` | `raider_iron.png` | Iron Lancer |
| `cutpurse_black` | `cutpurse_black.png` | Blackfeather |
| `ash_shaman_ember` | `ash_shaman_ember.png` | Ember Shaman |
| `ash_shaman_pale` | `ash_shaman_pale.png` | Pale Mender |
| `raider_ash` | `raider_ash.png` | Ash Champion |

色違い敵は別々のスプライトIDを持っています。元画像を複製して色調だけ変更したPNGを用意すれば、コード変更なしで上位種を区別できます。

### 3.4 新しいスプライトIDを追加する

`data/sprites.json`の`units`へ設定を追加します。

```json
"new_knight": {
  "path": "assets/characters/new_knight.png",
  "fallbackColor": "#5f8fd8"
}
```

次に`data/characters.json`のキャラクターへ同じIDを指定します。

```json
"sprite": "new_knight"
```

`fallbackColor`は画像がない時に表示される仮キャラの色です。

### 3.5 方向行を変更する

素材の方向順が違う場合、`directions`を変更します。行番号は0から始まります。

```json
"directions": {
  "down": 0,
  "left": 1,
  "right": 2,
  "up": 3
}
```

全キャラ共通なら`defaults`、特定キャラだけなら各スプライト設定へ記載します。

## 4. シナリオ立ち絵

### 4.1 推奨フォーマット

- PNG
- 推奨制作サイズ: `420x520`ピクセル以上
- 推奨比率: 横210 : 縦260
- 背景透過
- 顔から上半身が見える構図
- 重要な部分を中央に配置

ゲーム画面では`210x260`ピクセルの固定領域へ表示します。異なる比率の画像は伸縮されるため、できるだけ同じ比率で制作してください。

### 4.2 既存立ち絵の差し替え

現在設定されているファイル名:

| ID | ファイル | 主な対象 |
| --- | --- | --- |
| `rook` | `rook.png` | Rook、Captain Elricの仮立ち絵 |
| `nia` | `nia.png` | Nia、Tovinの仮立ち絵 |
| `mira` | `mira.png` | Mira、Sellaの仮立ち絵 |
| `boss` | `boss.png` | Iron Voss |

例としてMiraを差し替える場合:

1. `assets/portraits/mira.png`へ画像を置きます。
2. `data/portraits.json`の`imagePath`を確認します。
3. シナリオを開始し、会話ウィンドウとの重なりを確認します。

### 4.3 NPC専用立ち絵を追加する

`data/portraits.json`へ新しいIDを追加します。

```json
"sella": {
  "imagePath": "assets/portraits/sella.png",
  "accentColor": "#f0c15a"
}
```

その後、`data/scenario.json`の対象セリフで同じIDを指定します。

```json
{
  "speaker": "Sella",
  "speakerId": "sella",
  "portrait": "sella",
  "text": "会話本文"
}
```

`accentColor`は名前、会話枠、画像未設定時の仮立ち絵へ使われます。

## 5. スキルカットイン

### 5.1 再生条件

カットインは`SKILL`と`MAGIC`使用時に再生されます。通常攻撃、アイテム、待機では再生されません。

### 5.2 推奨フォーマット

- PNG
- 透明背景推奨
- 顔または上半身
- キャラクターを画像中央寄りに配置
- 元資料の目安: `480x180`ピクセル

現在のプロトタイプは画像を画面上の`260x226`領域へ固定描画します。縦横比の異なる素材は伸縮されるため、正式素材導入時には描画領域の比率調整も行う予定です。現状に完全に合わせる場合は`260x226`と同じ比率で制作します。

### 5.3 既存カットインの差し替え

| ID | ファイル |
| --- | --- |
| `rook` | `rook.png` |
| `nia` | `nia.png` |
| `mira` | `mira.png` |
| `raider` | `raider.png` |
| `cutpurse` | `cutpurse.png` |
| `ash_shaman` | `ash_shaman.png` |
| `boss` | `boss.png` |

例としてRookを差し替える場合:

1. `assets/cutins/rook.png`へ画像を置きます。
2. `data/cutins.json`の`rook.imagePath`を確認します。
3. Rookに`Power Slash`を使わせます。
4. 表示位置、技名との重なり、表示時間を確認します。

### 5.4 色と表示時間

```json
"rook": {
  "accentColor": "#8cc6ff",
  "durationMs": 950,
  "imagePath": "assets/cutins/rook.png"
}
```

| 設定 | 意味 |
| --- | --- |
| `accentColor` | 上下ラインと仮画像の色 |
| `textColor` | 名前・技名の色 |
| `bandColor` | カットイン帯の背景色 |
| `durationMs` | 表示時間、ミリ秒 |
| `imagePath` | PNGの相対パス |

キャラクターに`cutin` IDがあればそのIDを使い、なければ`sprite` IDを使ってカットイン設定を探します。Iron VossとAsh Championは`boss`を指定済みです。色違い上位敵へ専用カットインを付ける場合は、`data/cutins.json`へIDを追加し、必要なら`data/characters.json`の`cutin`へそのIDを指定してください。設定がない場合は共通設定による文字中心のカットインになります。

## 6. 未対応の画像

### マップタイル

現在の地形は`data/terrain.json`の色とCanvas描画で表示しています。PNGタイルセットを置くだけでは切り替わりません。正式ドット絵化では、地形IDとタイル画像を結ぶ設定を新設する必要があります。

### シナリオ背景

`data/scenario.json`には`background` IDがありますが、現在の描画処理は背景画像を読み込んでいません。IDは将来の背景画像対応に備えたものです。

### UI・アイコン

ウィンドウ、ボタン、HPバー、コマンドはCanvasとCSSで描画しています。現在は画像スキン方式ではありません。

### 戦闘エフェクト

ダメージ、回復、ミスは文字ポップアップです。攻撃・魔法のアニメーション画像は未実装です。

## 7. 差し替え確認手順

1. PNGを対応する`assets`フォルダへ置きます。
2. 必要なら対応JSONのパスとサイズを変更します。
3. `npm start`でゲームを起動します。
4. ブラウザで`http://127.0.0.1:4174/`を開きます。
5. `Ctrl + F5`でキャッシュを無視して再読み込みします。
6. キャラは4方向、立ち絵は会話枠、カットインは技名との重なりを確認します。
7. `npm run package`で配布フォルダへ画像を反映します。

特定の戦闘マップを直接開く場合:

```text
http://127.0.0.1:4174/index.html?route=ash_courtyard&mode=battle
```

## 8. チェックリスト

### キャラスプライト

- 4方向の行順が正しい
- 各フレームのサイズがJSONと一致する
- 隣のフレームが表示領域へ入り込まない
- 42x42表示でも輪郭と武器が判別できる
- HPバー、名前、向きマーカーと重ならない

### 立ち絵

- 会話枠で顔が隠れない
- 背景透過が正しい
- キャラごとの大きさが極端に違わない
- `accentColor`が画像と調和している

### カットイン

- 技名と顔が重ならない
- 透明部分の縁に不要な色がない
- 短い表示時間でもキャラを識別できる
- 味方と敵の色が見分けやすい

## 9. トラブル対処

| 症状 | 確認点 |
| --- | --- |
| 仮画像のまま | ファイル名、拡張子、JSONパスを確認 |
| 画像の一部だけ表示 | `frameWidth`、`frameHeight`、`idleFrame`を確認 |
| 向きが違う | `directions`の行番号を確認 |
| 画像がつぶれる | 元画像と描画領域の縦横比を揃える |
| 変更が反映されない | `Ctrl + F5`、サーバー再起動を試す |
| LOAD ERRORになる | JSONのカンマ、引用符、括弧を確認 |
| 配布版に画像がない | 画像追加後に`npm run package`を再実行 |

## 10. 関連ファイル

- `docs/sprite-format.md`: キャラスプライトの簡易仕様
- `docs/cutin-format.md`: カットインの簡易仕様
- `docs/current-design.md`: ゲーム全体の現状設計
- `data/characters.json`: キャラクターとスプライトID
- `data/scenario.json`: 会話と立ち絵ID
