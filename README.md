# わんにゃん視覚

写真を選び、犬・猫の色の区別を参考イメージで見比べる、小さなWebアプリ。

**[アプリを開く](https://wannyan-vision.pages.dev/)** · **[色変換のしくみ](docs/color-vision-theory.md)**

写真の選択、左右比較、全体表示、比較画像の保存・共有を使える。基本操作はスマホの一画面に収め、詳しい説明は「このアプリについて」から開く。文字拡大や低い横向き画面では、すべての操作へ届くようスクロールを許容する。

## 何を近似しているか

犬猫の見え方を完全に再現するアプリではない。人の二色型色覚を扱うMachadoら（2009）のモデルを、犬猫の色の区別を考えるための教育・娯楽用の代理に使っている。犬と猫には同じ変換を適用し、動物ごとに説明を切り替える。

RGBを線形化して行列で変換し、表示用のRGBに戻す。赤い物を消す、白黒にする、猫だけを任意にぼかす加工ではない。[理論解説](docs/color-vision-theory.md)には計算式、係数、数値例、一次資料、限界を記載した。

## 写真の扱い

- 写真は端末のブラウザ内で処理し、アプリのサーバーへ送信・保存しない。外部API・アクセス解析は使わない。
- 入力は30MB以下、処理する画像は長辺1600px以下。透過画像は白背景へ合成する。
- 再読み込みで選んだ写真は消える。保存PNGには元の写真のEXIF情報を引き継がない。
- 「共有」を選んだときだけ、利用者が選ぶ共有先へ画像やURLを渡す。送信完了は共有先で確認する。
- HEICなどの対応はブラウザに依存する。開けない場合はJPEGやスクリーンショットで試せる。

## ローカルで起動

Node.js 22以上を使用する。実行時の外部パッケージは不要。

```sh
git clone https://github.com/Akitaroh/wannyan-vision.git
cd wannyan-vision
npm run dev
```

[http://127.0.0.1:4174](http://127.0.0.1:4174)を開く。ES modulesを使うため、HTMLの直接ダブルクリックではなくHTTPで起動する。別ポートを使う場合は `WANNYAN_PORT=4180 npm run dev`。

```sh
npm test
```

色変換の数値、全256階調の灰色、入力不変・透明度、画像寸法、PNG生成の競合・失敗後の再試行などを確認する。

## フォルダ構成

```text
public/                    配信するアプリと素材
  vision.js                色変換の計算
  app.js                   写真読込・比較・画像保存
  NOTICE.txt               研究・係数・写真の出典と第三者ライセンス
docs/color-vision-theory.md 理論と実装の解説
scripts/serve.mjs           ローカル開発サーバー
tests/                     計算と保存処理のテスト
```

## 公開

Cloudflare PagesのDirect Uploadを使用する。配信対象は `public/` だけ。GitHubへのpushとデプロイは別操作であり、自動デプロイ連携は設定していない。

認証済みのWrangler CLIで、既存の `wannyan-vision` プロジェクトへ公開する場合：

```sh
wrangler pages deploy public --project-name wannyan-vision --branch main
```

別のプロジェクトへ公開する場合は、HTMLのcanonical・OGP URL、保存画像内のURLも公開先に合わせて変更する。`public/_headers` に外部通信を禁止するCSPなどを定義している。ローカル開発サーバーはCloudflare固有のヘッダー設定を再現しない。

## 確認範囲

PC上のブラウザで320×568、390×664、412×732 CSS pxの一画面表示、縦長写真、犬猫・比較・全体表示の切替、説明の開閉、PNG保存を確認した。CSSの文字倍率200%と低い横向き表示では、縦スクロールで操作へ到達できることを確認した。

iPhone・Android実機、X内ブラウザ、OSの文字設定、すべての画像形式、ネイティブ共有先への送信は未検証である。PCの表示サイズ検査を実機確認とは扱わない。

## 出典と素材

サンプルはThegreatmutataの実写写真「[Black dog with yellow ball on grass](https://commons.wikimedia.org/wiki/File:Black_dog_with_yellow_ball_on_grass.jpg)」（CC0 1.0）。犬猫のUIアイコンは独自のSVG。係数の照合に用いたDaltonLensのMIT通知を含め、詳細は [NOTICE.txt](public/NOTICE.txt) に記載した。

独自コード全体へのオープンソースライセンスは、現時点では設定していない。第三者素材・係数の通知はそれぞれの適用範囲で保持している。
