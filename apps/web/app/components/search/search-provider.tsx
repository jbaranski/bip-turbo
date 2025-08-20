import { useGlobalSearch } from "~/hooks/use-global-search";
import { GlobalSearchDialog } from "./global-search-dialog";

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { isOpen, open, close } = useGlobalSearch();

  return (
    <>
      {children}
      <GlobalSearchDialog open={isOpen} onOpenChange={(newOpen) => (newOpen ? open() : close())} />
    </>
  );
}
