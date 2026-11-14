// The agreement behind the "Accept NDA" button.
//
// It is kept here, in code, so that every version ever shown stays on record: a deal stores the
// version its two sides accepted, and that version can always be shown again word for word.
// To change the text, add a new version below and point NDA_VERSION at it. Never edit an old one.
//
// This text was written as a working draft and has not been reviewed by a lawyer. The governing
// law is left open on purpose. Both need settling before two real companies rely on it.

export type Clause = { title: string; body: string[] };
export type Agreement = { version: string; title: string; preamble: string[]; clauses: Clause[] };

const V_2026_11_14: Agreement = {
  version: '2026-11-14',
  title: 'Mutual non-disclosure and non-circumvention agreement',
  preamble: [
    'This agreement is between the buyer and the seller in a Gridstock deal room. Each is a "party". Gridstock is the marketplace that introduced them.',
    'A party accepts it by choosing "Accept NDA" in the deal room. It takes effect when both parties have accepted.',
  ],
  clauses: [
    { title: 'Purpose', body: [
      'The parties want to assess a sale of the equipment described in the listing and, if they agree terms, to complete it (the "purpose"). To do that they will learn who the other is and exchange information that is not public.',
    ] },
    { title: 'Confidential information', body: [
      '"Confidential information" means everything a party or Gridstock discloses in the deal room or in connection with it. That includes the identity of the other party and of its project, site and delivery details, prices, offers and budgets, submittals, drawings, test reports, photographs and other documents, and the fact that the parties are in discussion.',
    ] },
    { title: 'What each party agrees', body: [
      'Each party will use the other party\'s confidential information only for the purpose.',
      'Each party will keep it confidential, with at least the care it takes of its own confidential information and no less than reasonable care.',
      'Each party may share it only with its own employees, affiliates, lenders, insurers, advisers and contractors who need it for the purpose and are bound to keep it confidential. The party answers for what they do with it.',
      'Each party will tell the other promptly if it learns that confidential information has been used or disclosed in a way this agreement does not allow.',
    ] },
    { title: 'What is not confidential', body: [
      'Clause 3 does not apply to information that is public, or becomes public, other than through a breach of this agreement.',
      'It does not apply to information the receiving party already held, or later receives from someone else, without a duty of confidence.',
      'It does not apply to information the receiving party develops on its own without using the confidential information.',
      'A party may disclose what a law, regulation or court order requires. It will give the other party as much notice as the law allows and disclose no more than is required.',
    ] },
    { title: 'Non-circumvention', body: [
      'For 12 months after both parties accept this agreement, neither will buy the equipment in the listing, or any part of it, from the other, or sell it to the other, except through Gridstock. That holds whether they deal directly or through an affiliate, an agent or any other intermediary.',
      'If they do, the fee shown in the deal room becomes payable to Gridstock as if the sale had closed through it, and both parties are responsible for it.',
      'This clause does not apply where the parties can show from written records that they were already negotiating a sale of the same equipment with each other before Gridstock introduced them.',
    ] },
    { title: 'Return of information', body: [
      'If the sale does not go ahead, each party will return or destroy the other party\'s confidential information when asked. It may keep copies that the law requires it to keep, and copies in routine backups. Those stay covered by this agreement.',
    ] },
    { title: 'No other commitments', body: [
      'Nothing in this agreement obliges either party to buy or to sell.',
      'No licence and no ownership passes with any information.',
      'Each party gives information in good faith, and without any warranty. What the seller promises about the equipment is a matter for the purchase agreement between the parties.',
    ] },
    { title: 'Gridstock\'s role', body: [
      'Gridstock introduces the parties and hosts the deal room. It is not a party to any sale. It does not own, store, inspect or warrant the equipment, and it does not hold the purchase price.',
      'Gridstock will keep the parties\' confidential information confidential on the terms of clauses 3 and 4.',
      'Gridstock may enforce clause 5 in its own name.',
    ] },
    { title: 'How long it lasts', body: [
      'The duties in clauses 3 and 6 last for three years after both parties accept. For a trade secret they last for as long as the law protects it.',
      'Clause 5 lasts for the 12 months it states.',
    ] },
    { title: 'Remedies', body: [
      'A breach of this agreement may cause harm that money cannot fully repair. The party harmed may ask a court for an order to stop or prevent the breach, as well as any other remedy.',
    ] },
    { title: 'Acceptance and authority', body: [
      'Each person who accepts confirms that they have authority to bind the company named on their account.',
      'The parties agree that acceptance in the deal room is a signature, and that Gridstock\'s record of who accepted, when, and which version of this text, is evidence of it.',
    ] },
    { title: 'General', body: [
      'This is the whole agreement between the parties on its subject. It can be changed only in writing that both accept.',
      'If part of it cannot be enforced, the rest stands.',
      'Neither party may transfer it without the other party\'s consent, except to a successor to its business.',
    ] },
    { title: 'Governing law', body: [
      'The governing law, and the courts that hear disputes, will be named here before this agreement is used between real companies.',
    ] },
  ],
};

const VERSIONS: Record<string, Agreement> = { [V_2026_11_14.version]: V_2026_11_14 };

/** The version a new deal is asked to accept. */
export const NDA_VERSION = V_2026_11_14.version;

/** The text of a version. A deal with no version on record is shown the current one. */
export const agreement = (version?: string | null): Agreement =>
  (version && Object.hasOwn(VERSIONS, version) ? VERSIONS[version] : VERSIONS[NDA_VERSION]);

/**
 * Whether one side's acceptance counts. An acceptance made before the agreement had a text carries no
 * version. It stands on a deal that both sides had already accepted, and it is asked for again, on the
 * text, on a deal that was still waiting for the other side.
 */
export const ndaAccepted = (at: string | null, d: { stage: string; nda_version: string | null }) =>
  !!at && (d.stage !== 'nda' || !!d.nda_version);

/** The three things a person is agreeing to, for the panel beside the button. The full text governs. */
export const NDA_SUMMARY = [
  'Keep the other side\'s identity, project, prices and documents confidential for three years, and use them only to assess this purchase.',
  'For 12 months, buy or sell this equipment with each other only through Gridstock.',
  'Nothing here obliges you to buy or to sell.',
];

/** Shown wherever the text is shown, until a lawyer has reviewed it and the governing law is set. */
export const NDA_DRAFT_NOTE =
  'Draft for review. This text will be finalised with a lawyer, and its governing law set, before the first deal between real companies.';
