const HEADER = 'question,question_type,A,B,C,D,E,correct_answer,explanation,tags,user_answer';

const SHARED_RULES = `The header must be exactly:
${HEADER}

Rules:
- Return ONLY the CSV. No markdown fences, no explanation before or after.
- UTF-8, comma separated. Wrap in double quotes every field that contains a comma, a double quote or a line break, and double any internal quotes (""). This is the main thing that breaks imports.
- question_type is exactly one of: single_choice, multi_choice, true_false, short_answer.
- Options go in A, B, C, D (E optional). Fill them from A with no gaps, leave unused option cells empty, and never repeat the same option text twice.
- correct_answer:
  - single_choice: one letter, e.g. B
  - multi_choice: letters separated by commas, e.g. A,C
  - true_false: true or false, with A–E empty
  - short_answer: empty, with the model answer in explanation
- explanation: one or two sentences. For short_answer this is the model answer.
- tags: comma-separated topics inside a quoted field, e.g. "Pharmacology,Antibiotics".
- user_answer: always empty.
- Keep the original language of the questions.
- If the output is long, split it into parts, each starting with the same header. No commentary between parts.

Example rows (copy the quoting style):
"Which nerve innervates the deltoid?","single_choice","Axillary","Radial","Musculocutaneous","Median","","A","The axillary nerve (C5–C6).","Anatomy,Upper limb",""
"Select the prime numbers","multi_choice","2","3","4","6","","A,B","2 and 3 are prime.","Math,Primes",""
"The Earth orbits the Sun","true_false","","","","","","true","","Science",""
"Explain photosynthesis","short_answer","","","","","","","Plants turn light into chemical energy.","Biology",""`;

export const CREATE_PROMPT = `You are turning a study document into a question bank for a practice web app.

Source material: [attach the PDF / Word document, or paste its text here]
How many questions: [e.g. 100]
Subject / category: [e.g. Pharmacology]
Level: [e.g. medical licensing exam]
Language: [e.g. Albanian]

Write the questions strictly from the source material. Do not invent facts, and do not copy a question whose answer is missing from the document.

${SHARED_RULES}`;

export const FIX_PROMPT = `You are fixing a CSV of study questions so a web app can import it.

Below I paste (1) my CSV and (2) the errors the app reported for specific rows.

Return a corrected CSV that keeps every question, option and answer exactly as it is. Do not rewrite, translate, shorten, merge or invent content. Fix only the structure and the quoting, and make sure each correct_answer still points at the same option text it pointed at before.

${SHARED_RULES}

If a question has no answer anywhere in the original, leave correct_answer empty and put ANSWER_MISSING in explanation so I can delete that row myself.

My CSV and the errors:
[PASTE THE FILE CONTENTS AND THE ERROR LIST HERE]`;

/**
 * The fix prompt with the app's own row errors already inserted, so a student
 * only has to paste the file itself.
 */
export function buildFixPrompt(issues: ReadonlyArray<{row: number; message: string}>): string {
  const shown = issues.slice(0, 40).map(issue => `Row ${issue.row}: ${issue.message}`);
  const more = issues.length > 40 ? [`…and ${issues.length - 40} more.`] : [];
  const report =
    shown.length > 0
      ? `The app reported these rows:\n${[...shown, ...more].join('\n')}`
      : 'The app did not report a specific row; the CSV structure or quoting is still wrong.';

  return FIX_PROMPT.replace(
    '[PASTE THE FILE CONTENTS AND THE ERROR LIST HERE]',
    `${report}\n\nMy CSV (paste the whole file below):\n[PASTE THE CSV HERE]`,
  );
}
