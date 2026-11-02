import PublicLanding from "./PublicLanding";

import { getActiveMemberCount, getCurrentUser } from "./lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  const activeMemberCount = await getActiveMemberCount();
  return <PublicLanding signedIn={Boolean(user)} isAdmin={user?.role === "admin"} adminAvatar={user?.role === "admin" ? user.avatarDataUrl : null} activeMemberCount={activeMemberCount} />;
}
