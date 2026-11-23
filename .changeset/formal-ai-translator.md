---
'money-machine': minor
---

Add the Formal AI translator: an English → Russian translator that goes through Formal AI's meta language, with Wikidata-grounded concepts. It translates sentences, paragraphs and whole documents. `formal-ai with claude|codex|agent` runs a coding agent against a local model server.

Add `formal-ai roundtrip --via-russian` to regenerate English from the Russian analysis and report changes to the meta links.

Build Russian repository documentation and catalog data automatically in GitHub Actions, publish the Russian Pages mirror alongside the English catalog, and attach the generated content and translation report to the build.
