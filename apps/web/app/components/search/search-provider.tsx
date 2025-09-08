import { useGlobalSearch } from "~/hooks/use-global-search";
import { GlobalSearchDrawer } from "./global-search-drawer";

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, open, close } = useGlobalSearch();

  return (
    <>
      {children}
      <GlobalSearchDrawer open={isOpen} onOpenChange={(newOpen) => (newOpen ? open() : close())} />
    </>
  );
}
