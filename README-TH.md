# Apple Mail + Gmail Server MCP สำหรับ macOS — 0.3.0

แพ็กเกจติดตั้งบน Mac อีกเครื่อง รองรับ Apple Silicon และ Intel ในระดับ source (ไม่มี native binary ในแพ็กเกจ) ต้องมี Node.js 22 ขึ้นไปและอินเทอร์เน็ตสำหรับติดตั้ง npm dependencies ยังไม่ได้ทดสอบบน Mac ปลายทางจริงหรือบน Intel

## ติดตั้ง

หากใช้ GitHub สามารถ clone แล้วติดตั้งได้โดยตรง:

```sh
git clone https://github.com/SecTionXx/apple-mail-readonly-mcp.git
cd apple-mail-readonly-mcp
bash install.command
```

ต้องติดตั้ง Git, Node.js 22 ขึ้นไป และ npm ก่อน ส่วนวิธีติดตั้งจาก ZIP มีดังนี้:

1. แตก ZIP แล้ววางโฟลเดอร์ไว้ในตำแหน่งถาวร เช่น Documents/AppleMailMCP อย่าใช้งานจาก Downloads ชั่วคราว
2. ติดตั้ง Node.js 22 หรือใหม่กว่าจาก [nodejs.org](https://nodejs.org/) หากยังไม่มี
3. เปิด Terminal พิมพ์ `cd ` แล้วลากโฟลเดอร์ที่แตกไว้ลง Terminal กด Enter จากนั้นรัน:

```sh
bash install.command
```

ตัวติดตั้งใช้ `npm ci --ignore-scripts` ตาม package-lock ที่แนบมา รัน tests และตรวจ MCP handshake ไม่ติดตั้ง Homebrew/Node ให้เอง ไม่ใช้ sudo ไม่แก้การตั้งค่า Codex/Claude เดิม ไม่เปิดสิทธิ์ Automation หรือ OAuth ให้อัตโนมัติ

## เพิ่มเข้า MCP client

หลังติดตั้ง โฟลเดอร์ `generated-configs` จะมีไฟล์ที่อ้างถึง Node และตำแหน่งโปรเจกต์บนเครื่องปลายทาง:

- **Codex:** ใช้ส่วนกำหนด server ใน `codex.toml` เพิ่มใน config ของ client โดยรักษารายการเดิมไว้ หรือใช้ `sh generated-configs/codex-with-mail.sh` สำหรับ CLI แบบไม่แก้ global config (ต้องติดตั้ง Codex CLI ก่อน)
- **Client ที่ใช้ JSON mcpServers เช่น Claude Desktop:** รวมรายการ `apple-mail-readonly` จาก `mcp.json` เข้ากับรายการเดิม อย่าเขียนทับไฟล์ config ทั้งไฟล์
- `run-server.sh` ใช้เปิด stdio server โดยตรงสำหรับ client ที่รับ launcher command เซิร์ฟเวอร์จะรอ stdin ไม่ได้เปิดหน้าเว็บ

สำรอง client config ของเครื่องปลายทางก่อนแก้เอง แล้วเปิด client ใหม่ ตรวจว่ามี 12 tools หากย้ายโฟลเดอร์หรือเปลี่ยนที่ติดตั้ง Node ให้รัน `npm run setup` ใหม่และอัปเดต client config อีกครั้ง

## ใช้ Apple Mail บนเครื่องนั้น

เพิ่มบัญชีใน Apple Mail และตรวจว่าใช้งานได้ จากโฟลเดอร์แพ็กเกจรัน:

```sh
npm run doctor -- --mail
```

หาก macOS ขออนุญาตควบคุม Mail ให้ตรวจชื่อโปรแกรมแล้วอนุญาตด้วยตนเอง การอนุญาตจาก Terminal อาจไม่ครอบคลุม Codex/Claude ซึ่งเปิดโปรเซสคนละตัว เมื่อ client เรียก tool ครั้งแรกอาจถามอีกครั้ง ตรวจได้ที่ System Settings > Privacy & Security > Automation ไม่ต้องแก้ฐานข้อมูล TCC หรือปิดระบบป้องกันของ macOS

## อ่าน Gmail ทั้งเซิร์ฟเวอร์ (ไม่ต้องรอ Mail ดาวน์โหลด)

ขั้นตอนนี้เป็นทางเลือก Apple Mail tools ใช้ได้ก่อนเชื่อม Gmail API บัญชีที่ใช้กับ Gmail API ต้องเป็นบัญชีที่ผู้ใช้นั้นมีสิทธิ์เข้าถึง

1. ใช้ Google Cloud project ของผู้ใช้งาน/องค์กร เปิด **Gmail API** และตั้งค่า OAuth consent ตามนโยบายองค์กร หากเป็นแอป Testing ให้เพิ่มบัญชีใน Test users
2. สร้าง OAuth client ชนิด **Desktop app** และดาวน์โหลด client JSON เก็บไว้นอกโฟลเดอร์ที่จะแชร์ ไม่ต้องใส่ไฟล์นี้ใน ZIP
3. จาก Terminal ในโฟลเดอร์แพ็กเกจรัน โดยแทน path ด้วยไฟล์จริง:

```sh
npm run auth:gmail -- "/absolute/path/to/desktop-client.json"
```

4. โปรแกรมเปิด browser ให้เลือกบัญชีและอนุญาต **gmail.readonly** ผู้ใช้ล็อกอินเอง ไม่ส่งรหัสผ่านในแชต โปรแกรมใช้ PKCE/state และ callback บน 127.0.0.1 เท่านั้น หากถูกนโยบายผู้ดูแลบล็อก ต้องให้ผู้ดูแลตรวจอนุญาต ไม่ข้ามคำเตือน
5. ตรวจการเชื่อมต่อ:

```sh
npm run doctor -- --gmail
```

โปรแกรมเก็บ token ใหม่เฉพาะเครื่องนี้ใน `~/Library/Application Support/AppleMailMCP/auth/credentials.json` (0600) และเก็บเฉพาะ path ของ client JSON โดยไม่คัดลอก client JSON ต้องเก็บไฟล์ client JSON ไว้ที่เดิม ใช้หนึ่งบัญชี Gmail API ต่อ data home

หากมี credential อยู่แล้ว auth helper จะหยุดเพื่อไม่เขียนทับ การใช้บัญชีอื่นหรือทดลองใหม่ทำได้โดยตั้ง `APPLE_MAIL_MCP_HOME` เป็นโฟลเดอร์ใหม่แบบ absolute แล้วรัน auth/setup ภายใต้ค่าเดียวกัน ตัว config ที่สร้างจะบันทึก environment ตัวนี้ด้วย อย่านำ token ของเครื่องเดิมหรือของผู้อื่นมารวมในแพ็กเกจ

รายละเอียด OAuth: [เอกสาร Desktop Apps ของ Google](https://developers.google.com/identity/protocols/oauth2/native-app) สิทธิ์/อายุ token ขึ้นกับสถานะแอปและนโยบายบัญชี หากหมดอายุหรือถูกเพิกถอนจะรายงาน `GMAIL_REAUTH_REQUIRED`

## เครื่องมือ 12 ตัว

| กลุ่ม | Tools |
| --- | --- |
| Apple Mail | list_accounts, list_mailboxes, list_messages, search_messages, read_message, list_attachments, download_attachment |
| Gmail server | server_mail_status, server_list_messages, server_read_message, server_download_attachment, server_scan_mailbox |

ใช้ `server_mail_status` ตรวจว่าบัญชีถูกต้องก่อนใช้ API ห้ามใช้ ID ของ Apple Mail สลับกับ ID ของ Gmail API

`server_scan_mailbox` สแกน unique message ID ทุกหน้า รวม Spam/Trash พร้อม checkpoint เรียกต่อด้วย scan_id จนหมด เมื่อจำนวนตรงกับ server และ history ID ไม่เปลี่ยนจะได้ `verified_message_inventory` หาก `changed_during_scan` หรือ `count_mismatch` ห้ามสรุปว่าครบ การสแกนนี้ไม่ใช่การสำรองเนื้อหา/ไฟล์แนบทุกฉบับ และไม่รวมเมลที่ลบถาวรหรือ retention archive ที่ผู้ดูแลเท่านั้นเข้าถึง

## ขอบเขตและข้อมูลที่จัดเก็บ

- ไม่มี tools ส่ง ลบ ย้าย หรือแก้สถานะเมล ใช้ Gmail GET-only; POST ใช้เฉพาะ OAuth token exchange/refresh
- เครื่องมือดาวน์โหลดและสแกนเขียนข้อมูลลงเครื่อง จึงประกาศ readOnlyHint=false แต่ไม่แก้ไข mailbox
- ข้อมูล runtime แยกจาก source ใต้ `~/Library/Application Support/AppleMailMCP/data` ไม่ติดไปเมื่อย้าย ZIP
- ดาวน์โหลดไฟล์แนบได้สูงสุด 25 MiB ต่อไฟล์ ตั้งชื่อปลอดภัยและใช้โฟลเดอร์ใหม่เพื่อไม่เขียนทับ ไม่เปิดหรือ execute ไฟล์
- Apple Mail tools เห็นข้อมูลตามที่ Mail เปิดให้ scripting; Gmail API tools อ่านจากเซิร์ฟเวอร์ของบัญชีที่อนุญาตจริง
- ค้นหา Apple Mail เป็น subject/sender แบบแบ่งหน้า; ค้นหา server ใช้ Gmail query และต้องตาม next_page_token จนหมด
- OAuth helper ใหม่ทดสอบด้วย callback จำลอง ยังไม่ได้ทำ live sign-in บนเครื่องปลายทาง การ login/consent เป็นขั้นตอนที่ผู้ใช้ต้องทำบนเครื่องนั้น
- Gmail API adapter รุ่นก่อนหน้าทดสอบกับบัญชีจริงบนเครื่องพัฒนาแล้ว แต่ผลนั้นไม่ใช่หลักฐานว่าบัญชีใหม่เชื่อมสำเร็จ
- ยังไม่รองรับ Microsoft 365 ผ่าน API; บัญชีใดที่เพิ่มใน Apple Mail อาจอ่านผ่าน Apple Mail tools ได้ตามข้อจำกัดของ Mail

## ตรวจ/แก้ปัญหา

```sh
npm test
npm run doctor
npm run doctor -- --mail
npm run doctor -- --gmail
```

`doctor` ปกติทดสอบ MCP โดยไม่อ่านเมล ส่วน --mail อ่านจำนวนบัญชี และ --gmail อ่าน profile/count เท่านั้น ไม่มี body ใน output หากพบ `AUTOMATION_PERMISSION_REQUIRED` ให้ผู้ใช้ตรวจ Automation; หาก `GMAIL_AUTH_NOT_CONFIGURED` ให้ทำ OAuth ด้านบน หากย้าย client JSON กลับไปตำแหน่งเดิมหรือเชื่อมบัญชีใหม่ใน data home ใหม่

## ยกเลิกใช้งาน

ลบเฉพาะรายการ MCP ที่เพิ่มใน client config เพื่อหยุดใช้งาน ข้อมูลใน Application Support ยังอยู่โดยตั้งใจ หากต้องการล้าง ให้ผู้ใช้ตรวจโฟลเดอร์นั้นและลบเอง รวมถึงเพิกถอนสิทธิ์แอปผ่าน Google Account เมื่อไม่ใช้แล้ว ตัวติดตั้งไม่มีคำสั่งล้างข้อมูลอัตโนมัติ
