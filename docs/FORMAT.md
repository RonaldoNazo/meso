# Question file format

One file = one dump. CSV, TSV and semicolon-separated text all work; the delimiter is
detected from the header row. Excel (`.xlsx`, `.xls`) is read from the first sheet. You
can also paste straight out of a spreadsheet — that produces tabs, which is the most
robust option.

## Header

```csv
question,question_type,A,B,C,D,correct_answer,explanation,tags,user_answer
```

Columns are matched by name, so order does not matter and extra columns are ignored.
Only `question` and `question_type` are required; everything else is optional per row.

| Column | Required | Notes |
|---|---|---|
| `question` | yes | The stem. Plain text; HTML is shown as text, never rendered. |
| `question_type` | yes | `single_choice`, `multi_choice`, `true_false`, `short_answer` |
| `A`–`H` | choice types | Options must be continuous from A: if C is filled, B must be too. E–H are optional. |
| `correct_answer` | choice types | `B` for single, `A,B` for multi, `true`/`false` for true/false. Accepts lowercase, `A.`, `(A)` and `1`–`8` as well. |
| `explanation` | no | Shown after answering. For `short_answer` this is the model answer. |
| `tags` | no | Comma- or semicolon-separated, e.g. `Math,Addition`. Used for filtering. |
| `user_answer` | no | Ignored on import. Kept so exported dumps round-trip. |

## The four types

```csv
question,question_type,A,B,C,D,correct_answer,explanation,tags,user_answer
2 + 2 = ?,single_choice,3,4,5,6,B,2 + 2 = 4,"Math,Addition",
Select the prime numbers,multi_choice,2,3,4,6,A,B,2 and 3 are prime,Math,
The Earth orbits the Sun,true_false,,,,,true,,Science,
Explain photosynthesis,short_answer,,,,,,"Plants turn light into chemical energy.",Biology,
```

- **single_choice** — one option. All-or-nothing scoring.
- **multi_choice** — checkboxes and a confirm button. All-or-nothing; the feedback says
  how many of the correct options you picked. A single letter is valid (one correct
  option), but the UI still asks you to confirm.
- **true_false** — A–D stay empty and `correct_answer` is `true` or `false` (also `T`,
  `F`, `yes`, `no`, `1`, `0`). The app renders True/False buttons.
- **short_answer** — no options and no key. The app shows what you typed (optional) and
  reveals `explanation`; you then mark it “I got it” or “I missed it”. If both
  `explanation` and `correct_answer` are empty there is nothing to reveal, so the row is
  skipped with a warning.

## Validation

Rows fail individually; the import screen lists them with row numbers and can import the
valid rest.

| Problem | Result |
|---|---|
| Empty `question` | error |
| Unknown `question_type` | error |
| Fewer than two options on a choice question | error |
| Answer points at an empty or missing option | error |
| `single_choice` with more than one answer | error |
| `true_false` whose answer is not a boolean word | error |
| A gap in the options (`A`, empty `B`, `C`) | repaired: the empty cell is dropped, warnings are shown, answer letters follow their option |
| Two identical options in one question | repaired: the repeat is merged into the first, answer letters are remapped |
| Duplicate question (same stem + options + type) | warning, second copy skipped |
| `short_answer` with no answer text | warning, row skipped |
| Choice question with no `correct_answer` | error, row skipped |

If `question_type` is missing entirely, the app infers it: no options → short answer;
`true`/`false` → true/false; two or more answer letters → multiple choice; otherwise
single choice. Explicit types are always safer.

Limits: 15 MB per file, 20,000 rows per dump.

## Let an AI produce the file

The Import screen has two copyable prompts under **Let AI build the CSV**:

- **Create from a document** — attach a PDF or paste lecture notes, ask for N questions,
  and get a CSV in this format.
- **Fix import errors** — paste the file plus the exact error lines, and get the same
  questions back with quoting and option problems repaired.

Both prompts spell out the header, the four types and the quoting rules, so the output
imports without a second round of fixing.

## The quoting trap

In a comma-separated file, a field containing a comma must be quoted:

```csv
"Math,Addition"
```

Without quotes the columns shift right and the row fails with “Unknown question_type” or,
if the row grows, “Row has 11 fields but the header has 10”. Tab-separated files are
immune, which is why copying from a spreadsheet is the safest path.

## Identity and progress

Every question gets an id: a hash of its type, normalised stem and options. Answer
history is keyed by that id, globally.

- Editing the explanation, tags or reference does **not** reset progress.
- Editing the stem or an option makes it a new question; the old record stays but is no
  longer attached to anything.
- The same question in two dumps shares one record, and mixed sessions never show it
  twice.
