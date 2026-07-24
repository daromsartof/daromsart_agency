import { Card, CardContent, CardHeader, CardTitle, Label } from "@daromsart/ui";
import { requireSession } from "@/modules/auth/session";
import { NameCard } from "./name-card";
import { PasswordCard } from "./password-card";
import { ThemeCard } from "./theme-card";

export const metadata = { title: "Mon compte" };

export default async function ComptePage() {
  const session = await requireSession();

  return (
    <div className="space-y-6">
      <NameCard initialName={session.user.name} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Email</Label>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </CardContent>
      </Card>
      <PasswordCard />
      <ThemeCard />
    </div>
  );
}
