# M1 draft notes: open items and decisions taken

Draft date: 2026-08-30. Files in this folder: profile.json, schema.ts,
chat-projection.md, notes.md. Sources read: m1-content-checklist.md (owner-ticked),
zurielst.com/.tri/plan.md (revision 2), zurielst.com/.tri/intent.md, the old
terminal site (Leiruz/Zuriel: index/skillset/awards/certifications/projects + Zuriel.js),
the current live site (Leiruz/resume: index.html), and the live resume PDF.

## 1. Interpretation note (flagging, not deciding silently)

The owner drop list (5, 6, 16, 33, 57, 70, 74, 75, 76, 80, 81, 86, 87, 88, 115,
116, 117, 118, 121, 123, 124) omits six items the checklist itself tags [DROP]:
10 (old capability grid labels), 21 (CiTaDel pricing tiers), 49 (Edusave award),
68 (WiFi Tracer), 69 (YouTube Converter), 71 (private repos: no cards, no links).
I treated all six as standing drops: shipping their content would contradict the
act structure (10), the checklist's own hard rule and intent.md (71), and the
curation rationale of the rest (21, 49, 68, 69). If any of the six was meant to
ship after all, say which and I will fold it in.

## 2. Component picks requested by kept rationales

- Item 100 (one hero text effect): recommend shimmering-text over
  fluid-gradient-text. Quieter, closer to the dossier intent ("meticulous,
  truthful, fast"), and it will not fight the dark/light token sets the way a
  gradient fill can. Decide before M4.
- Items 104 vs 105 (line-nav vs toc-minimap, "keep at most one"): recommend
  line-nav (the KEEP-tagged core pick); skip toc-minimap. Decide before M3.
- Item 91 (exactly one theme-toggle-effect): pick the effect at M2 when the
  theme-switcher is vendored; no content impact.
- Item 96 (testimonial-spotlight vs testimonials-marquee): recommend
  testimonial-spotlight with the Tan Hock Guan quote (decision 119 kept
  testimonials). Testimonial content is NOT yet in profile.json: the CiTaDel
  testimonials need to be pulled from the citadel subdomain and added as a
  section (schema change) or dropped into the CiTaDel case card. Open item.
- Item 97 (social-proof-01 / logos-carousel): comfort call on using employer and
  school logos still open. Content works without it.
- Item 98 (metrics-01): kept; identity.metrics is shaped for it (4 entries).
- Item 111 (hero-01 base layout): implementation detail for M4, no content impact.
- Item 112 (blog-01/02): excluded as a consequence of decision 121 (no blog),
  even though 112 itself was not in the drop list.
- Item 114 (team-01): only use found would be a CiTaDel-era team vignette; no
  such content exists in the sources, so recommend skip unless the owner writes one.

## 3. TODO links and media (awaiting media audit, M9/M10)

Every /media/ path in profile.json is a forward reference. Mapping from the old
terminal repo (C:\Users\Zuriel\Documents\Github Repos\Zuriel\media):

- /media/portrait.jpg               <- Zuriel_new.jpg (item 7)
- /media/cases/citadel.png          <- CiTaDel.png (item 22)
- /media/products/cinderella-demo.mp4 <- file.mp4 (item 59; 34.6 MB, needs compression)
- /media/products/ngee-ann-badminton.png <- Ngee Ann Badminton.png
- /media/products/xynthea.png       <- Project Xynthea.png
- /media/proof/singtel-scholarship.jpg <- SingTel Scholarship Certificate.jpg
- /media/proof/homeless-hearts-appreciation.png <- HHOS.png
- /media/proof/cyberark-trustee.png <- Cyberark Trustee Certification - Zuriel Shanley Tanyory-1.png
- /media/proof/cyberark-pam-intro.png <- CyberArk Training Cert-1.png
- /media/proof/carbon-black-fundamentals.png <- VMware Carbon Black Certification-1.png
- /media/proof/nus-zero-to-one.jpg  <- Zuriel Shanley Tanyory - Zero_to_One NUS cert.jpg
- /media/proof/govtech-stack-the-flag-2020.png <- Stack The Flag CTF.png
- /media/proof/cddc-2020-gold-reverse-engineering.png <- CDDC Gold scan (five more CDDC
  scans exist and can back a gallery on the same tile: Silver x3, Bronze, ML recognition)
- /media/proof/mindef-bug-bounty-2019.png <- MinDEF Bug Bounty.jpeg (sharper than the
  PNG crop per media-audit.md; ship one of the two only)
- /media/proof/cys-eae-hackathon-2020.png <- Cyber Youth Singapore EAECon-1.png
- /media/proof/fortinet-fcac.png    <- Fortinet_Certified_Associate_In_Cybersecurity.png
- /media/proof/fortigate-74-operator.png <- Fortinet_Course_Completion_Certificate.png

Missing media (no source file found; profile.json ships these entries without an
image field, or with a placeholder noted here):

- TODO-media: Singtel BIG Fearless Find 2026 award (item 34): no scan exists yet.
- TODO-media: Cisco Cyber Threat Management cert (item 36): the only Cisco scan in
  the media folder is the "Find Yourself In The Future" tech-talk cert, which is a
  DIFFERENT credential. Do not attach it. Source the right scan or ship without.
- TODO-media: Cyber Youth Singapore Camp CTF 2019, Shopee Code League 2020, and
  YCEP 2020 tiles have no scans.
- TODO-media: NullSec promo video (item 56): referenced as
  /media/proof/nullsec-promo.mp4 in proof_wall.extras but NO file exists in the
  terminal repo media folder. Locate the file or delete the extras entry before M5.
- TODO-media: /media/og-card.png (meta.og.image): to be produced during the build.

Item 35 standing action (personal-data audit of scans): DONE separately; see the
sibling media-audit.md in this folder (all 46 images inspected, all verdicts SHIP
as-is; file.mp4 still needs a manual end-to-end review before the Cinderella demo
ships). Two of its findings adjust the mapping above: source the MINDEF tile from
the sharper "MinDEF Bug Bounty.jpeg" instead of the PNG crop, and downscale the
oversized EAECon PNG (15359x8639) before shipping.

Item 20 action: the citadel.zurielst.com link ships WITH a wound-down note (link
note is in profile.json). The subdomain itself still needs its "wound down" banner
before cutover, or the link comes out.

## 4. Publications (item 122): resolved

bit.ly/DeepLearning2020 resolves (HTTP 301) to a public Google Drive folder:
https://drive.google.com/drive/folders/1N7A2WHvPJiihm2eXhwp3VmWllMkuiwe5
The folder holds exactly two files, and both per-file links were extracted and
verified returning HTTP 200 anonymously on 2026-08-30:

- CNN Report Analysis.docx -> https://drive.google.com/file/d/1exyLnYXMif0SoR70TCmoyX6WuxeUTSFT/view
  (used for "Food Image Classification Using Convolutional Neural Network with LSTM and GRU")
- RNN Report Analysis.docx -> https://drive.google.com/file/d/1PJjhYrP9lBMyRSK_nwDxmFuIBTQ7_W12/view
  (used for "Emoji Prediction and Autocorrect Using Recurrent Neural Network")

So the two proper separate links exist and no bit.ly dependency remains. Note the
resume PDF spells "Covolutional"; profile.json corrects it to "Convolutional".
Longer-term consideration (not blocking): Drive links depend on the folder staying
public under the owner's account; self-hosting PDFs under /media/proof/ would be
more durable.

## 5. Content decisions taken in this draft (review welcome)

- Items 47 + 48 merged into ONE wall tile (Cyber Youth Singapore EAE Hackathon
  2020 appreciation, caption covering the EAE consultant + panelist volunteering).
  Two tiles for one event credit would read as double-counting.
- Item 46 (YCEP) framing per its "pick one framing" rationale: the wall tile is
  the PARTICIPANT credit; the ORGANIZER credit lives only in the NullSec timeline
  entry. YCEP appears once per section, never twice in one.
- Item 51 (Advanced Computing Mathematics) folded into the Ngee Ann Polytechnic
  education entry, per its rationale; it is not a wall tile.
- Item 4 ("started coding at 14") ships as identity.bio_hook. With decision 124
  dropped there is deliberately NO prehistory evidence behind it; it stays a
  one-liner.
- Item 61 (Xynthea) reframed as an origin story per its rationale: the summary
  names MD5 as dated on purpose and positions the project as the starting marker.
- Item 24/125 (ConfigProof AI): fourth work case at exactly resume-level wording
  ("developed ConfigProof AI for vendor security risk assurance"), zero stack,
  zero links, with a note saying the card stops at the resume line by design.
- Items 63/64 wording risk: PanPath-Redactor and edl-akamai are PUBLIC repos that
  currently contain ONLY a zip file each (PanPath-Redactor.zip,
  edl-akamai-connector.zip) and no README. Their one-line summaries in
  profile.json are conservative inferences from the repo names and must be
  verified (or the repos given real source + READMEs, which would also help the
  "shows current craft" goal) before M5. Palo-Alto-Firewall-IOC-Automation HAS a
  README and its summary is grounded in it ("add-only IOC manager" wording).
- Item 78: LinkedIn URL used is https://www.linkedin.com/in/zuriel-shanley/
  (resume's clean form). Confirm it is the current vanity URL.
- Identity roles for the text-flip rotator were composed from sourced role nouns
  (resume role line + current-site lead): FD AI & Automation Security Engineer /
  Information Security Undergraduate / SOC Builder / Founder.
- SingTel vs Singtel: prose uses "Singtel" (checklist item 1 wording); the
  scholarship tile keeps its historical proper name "SingTel Cyber Security
  Cadet Scholarship".
- The terminal easter egg ships the 13 commands from item 85; the note field
  records the sanitization re-pointing (contact = NUS email only, education
  starts at 2019 per decision 124, games = TowerBlock per decision 120).
- Fearless Find caption is deliberately plain; no scan and no extra detail exist
  in the sources beyond the resume line.

## 6. Schema notes

- schema.ts implements the four required rejections (SG phone shape regex, the
  personal webmail domain, and the two personal-gift subdomain substrings named
  in the brief) as a recursive walk over every string AND every object key, via
  superRefine on the root schema.
- One addition beyond the brief: an em dash rejection (written as /\u2014/ so the
  schema file itself stays em-dash free). Traced to intent.md ("Em dashes in site
  copy or docs" are a stated non-acceptance) and the M1 instruction that these
  files carry none. Remove the check if it is considered scope creep.
- Deliberately strict choices: identity.email pinned to the literal
  "zurielst@u.nus.edu" (standing default 3); socials pinned to exactly GitHub +
  LinkedIn (item spec); publications pinned to exactly 2; metrics to exactly 4;
  acts to exactly 3; work_cases 3 to 4. Loosen knowingly, not accidentally.
- All URLs must be https; all media references must start with /media/.

## 7. Projection token estimate (chat-projection.md)

Measured on the delimited block only (<<PROFILE ... PROFILE>>):
- 4,512 characters, 635 words.
- chars/4 estimate: ~1,128 tokens. words x 1.35 estimate: ~857 tokens.
- Best estimate: roughly 950 to 1,150 tokens, under the 1,200 target with margin.
  The block is dense with digits and punctuation, so the true count likely sits
  between the two estimators; verify with the real tokenizer at M6 when the
  worst-case-tokens measurement happens anyway (plan F4).

## 8. Traceability quick-map

- identity: checklist 1, 2, 3, 4, 7, 8, 77, 78, 79 (resume + current site).
- capabilities: 9, 11, 12, 13, 14, 15 (resume + terminal skillset page + old Wix
  since-dates); act narratives paraphrase the nine first-person write-ups.
- work_cases: 17, 18, 19, 20, 22, 24, 125 (resume bullets, lightly voiced).
- timeline: 23 to 32, 51 (resume wording).
- proof_wall: 34 to 48 (minus 49 per its DROP tag), 50, 52, 53, 54, 55, 56, 122.
- products: 58 to 67 (minus 68, 69 per their DROP tags), grounded against the
  public GitHub repo list and READMEs on 2026-08-30.
- faq: 72, 73 (fresh answers written for 2026 status).
- chat: 82, 83, 84 (chips rewritten for the new sections; scope and denylist are
  encoded in chat-projection.md's instruction block).
- easter_eggs: 85, 120.
- meta: new copy, no phone, no gmail, resume-level Singtel wording.

## 9. Self-validation performed

- profile.json parses (PowerShell ConvertFrom-Json pass).
- Grep over all four files: zero em dashes (U+2014), zero en dashes (U+2013),
  zero matches for the SG phone shape regex, the personal webmail domain, the
  two personal-gift subdomain substrings, the old phone digits, the home-area
  name, and the dropped social handle. The single sanctioned exception: the two
  subdomain substrings appear inside schema.ts's FORBIDDEN_SUBSTRINGS array,
  where the brief itself requires them.
- Mental schema pass: every profile.json field is declared in schema.ts with
  matching optionality; enums cover all values used; strict objects match keys.
