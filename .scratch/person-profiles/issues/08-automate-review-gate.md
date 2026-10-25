# Automate the review gate

Type: grilling
Status: open
Blocked by: 03

## Question

Output ships only `reviewed` and `edited` Profiles, and only the user moves `draft` to `reviewed`. How is that automated without letting unchecked claims through? Cover: which verifier verdicts and `meta.validation` flags auto-promote a Profile, which block it, which only advise; whether a Profile with any `contradicted` claim can ever auto-promote; how `confidence` and `is_legend` order the human queue for what remains; and whether the promotion is a pipeline step or a command run after the verifier reports.
