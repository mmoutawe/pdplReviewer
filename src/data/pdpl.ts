/* PDPL article excerpts used for grounded AI citations.
 * These are paraphrased summaries of the Saudi Personal Data Protection Law
 * (Royal Decree M/19, 2021, amended 2023) for prototype demonstration only.
 * In production, fetch the canonical text from the policy library service.
 */

import type { Citation } from './types'

export interface PdplArticle {
  id: string
  number: string
  title: string
  excerpt: string
}

export const PDPL_ARTICLES: PdplArticle[] = [
  {
    id: 'pdpl-art-3',
    number: 'Article 3',
    title: 'Scope of application',
    excerpt:
      'The Law shall apply to any processing of personal data of individuals in the Kingdom by any means, including processing by entities outside the Kingdom directed at data subjects in the Kingdom.',
  },
  {
    id: 'pdpl-art-5',
    number: 'Article 5',
    title: 'Lawful basis for processing',
    excerpt:
      'Personal data may not be processed without the prior consent of the data subject, except in cases specified by law including the realization of a legitimate interest, performance of a contract, or compliance with a legal obligation.',
  },
  {
    id: 'pdpl-art-6',
    number: 'Article 6',
    title: 'Sensitive personal data',
    excerpt:
      'Sensitive personal data — including health, biometric, genetic, ethnic, and religious data — shall not be processed without explicit consent and the implementation of strengthened safeguards.',
  },
  {
    id: 'pdpl-art-12',
    number: 'Article 12',
    title: 'Disclosure to third parties',
    excerpt:
      'A data controller may not disclose personal data to a third party except in accordance with a defined lawful basis and where appropriate contractual safeguards (including a Data Processing Agreement) are in place.',
  },
  {
    id: 'pdpl-art-15',
    number: 'Article 15',
    title: 'Data minimization and purpose limitation',
    excerpt:
      'Personal data collected shall be limited to what is necessary for the specified, explicit, and legitimate purpose, and shall not be further processed in a manner incompatible with that purpose.',
  },
  {
    id: 'pdpl-art-18',
    number: 'Article 18',
    title: 'Retention',
    excerpt:
      'Personal data shall not be retained for longer than is necessary to fulfill the purpose of its collection unless otherwise required by law. Retention periods shall be documented.',
  },
  {
    id: 'pdpl-art-19',
    number: 'Article 19',
    title: 'Security of processing',
    excerpt:
      'Controllers shall implement organizational and technical measures sufficient to preserve the confidentiality, integrity, and availability of personal data, including encryption and pseudonymization where appropriate.',
  },
  {
    id: 'pdpl-art-29',
    number: 'Article 29',
    title: 'Cross-border transfer',
    excerpt:
      'Transfer of personal data outside the Kingdom is permitted only where the destination jurisdiction provides an adequate level of protection or where appropriate safeguards are implemented (such as standard contractual clauses or binding corporate rules), and where the transfer does not prejudice national interests.',
  },
  {
    id: 'pdpl-art-30',
    number: 'Article 30',
    title: 'Local copy requirement for critical data',
    excerpt:
      'Where personal data relates to critical sectors as designated by the Competent Authority, a copy of such data shall be retained within the Kingdom even where transfer abroad is permitted.',
  },
  {
    id: 'pdpl-art-33',
    number: 'Article 33',
    title: 'Breach notification',
    excerpt:
      'In the event of a personal data breach likely to cause harm to data subjects, the controller shall notify the Competent Authority and affected data subjects without undue delay and within a maximum of seventy-two (72) hours of becoming aware of the breach.',
  },
  {
    id: 'pdpl-art-37',
    number: 'Article 37',
    title: 'Penalties',
    excerpt:
      'Violations of this Law are subject to administrative penalties of up to SAR 5,000,000 per violation and may include criminal liability for unauthorized disclosure of sensitive personal data.',
  },
]

export function pdplCitation(articleId: string): Citation {
  const a = PDPL_ARTICLES.find((x) => x.id === articleId)!
  return {
    id: `cite-${articleId}`,
    source: 'pdpl',
    ref: `PDPL ${a.number}`,
    excerpt: a.excerpt,
  }
}

export function policyCitation(code: string, title: string, excerpt: string): Citation {
  return {
    id: `cite-${code}`,
    source: 'policy',
    ref: code,
    excerpt: `${title} — ${excerpt}`,
  }
}
