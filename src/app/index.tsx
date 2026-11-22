import { Redirect } from "expo-router";

import { Loading } from "@/components/ui";
import { useDriver } from "@/lib/driver";

export default function Index() {
  const { loading, session } = useDriver();
  if (loading) return <Loading />;
  return <Redirect href={session ? "/inicio" : "/entrar"} />;
}
