/** Comitative "with": a partner takes «с», a tool the bare instrumental. */

import { isPerson } from './phrase.mjs';

/**
 * "work with clients": a bare instrumental is a tool (работать молотком);
 * a person or a named party is a partner, «с клиентами».
 */
export function withPartner(gov, marker, e, ctx) {
  return marker === 'with' &&
    !gov.preposition &&
    gov.case === 'ins' &&
    ctx &&
    (e?.name || isPerson(e, ctx))
    ? { ...gov, preposition: 'с' }
    : gov;
}
