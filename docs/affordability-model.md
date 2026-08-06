# The affordability model

`tools/affordability/js/model.js` holds every rule and threshold as pure
functions, with no DOM or storage access. That is deliberate: the judgement a
tool like this makes should be readable in one file and testable on its own,
not scattered through event handlers.

## It does not invent a score

Plenty of calculators produce a number out of nowhere and present it as
authority. This one runs your purchase past published guidelines and reports,
one by one, which of them it clears:

| Check | Guideline |
| --- | --- |
| Your safety net | An emergency fund covering 3–6 months of expenses |
| Room in your month | 50/30/20 budgeting — needs, wants, savings |
| Share of your income | Category ceilings, e.g. 30% for housing |
| Everything you owe | The 28/36 debt-to-income rule from mortgage underwriting |
| What borrowing adds | Total interest as a share of the price |
| How the loan is set up | 20/4/10 for vehicles: 20% down, ≤4 years, ≤10% of income |

The 30% housing figure is the threshold used to define "cost burdened" in
housing policy; above roughly 50% is "severely cost burdened".

## Stricter than a lender

Every threshold is applied to **take-home** pay, not gross. Lenders normally
work from gross income, which means these checks are deliberately harder to
pass than a bank's version of the same rule. A bank is optimising for whether
you will repay; this is optimising for whether you will be comfortable.

## It answers "how much", not just "whether"

A yes/no is rarely the useful answer. When a purchase does not clear, the model
bisects *itself* — running the full check suite at trial prices — to find the
largest price that would clear everything outright.

That is a stricter bar than the `yes` verdict, which tolerates a single
warning. A number described as comfortable should have no caveats attached to
it, so the search requires every check to pass cleanly.

Two consequences worth knowing:

- If **no** price clears, the tool says so plainly rather than implying a
  discount would fix it. A 10%-down 72-month car loan fails on structure at
  any price, and pointing at the sticker would be misleading.
- The search bound expands until it actually fails, so the headroom figure is a
  property of the rules rather than an artefact of where the search started.

## Blank is not zero

An empty field and a deliberate `0` mean different things. "I have no other
debt" is a claim; leaving the box untouched is a shrug. Treating them the same
is how a calculator hands back a confident wrong answer.

The view passes an `answered` map alongside the numbers. Unanswered questions
render as a neutral "add this" prompt rather than a warning, and they are
excluded from the verdict maths so a blank field can never turn a clean *yes*
into *go in deliberately*.

## What it does not know

Your tax situation, your job security, whether the thing will hold its value,
and what it is actually worth to you. It is a sanity check, not financial
advice.
