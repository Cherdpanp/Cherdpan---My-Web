import { createTravelService } from '../lib/travel-service.mjs';
const handle=createTravelService();
export default { fetch: handle };
