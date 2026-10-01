import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type TabStateOptions<T extends string> = {
  defaultTab: T;
  validTabs: readonly T[];
  paramName?: string;
};

export function useUrlTabState<T extends string>({
  defaultTab,
  validTabs,
  paramName = "tab",
}: TabStateOptions<T>) {
  const location = useLocation();
  const navigate = useNavigate();
  const validSet = useMemo(() => new Set<string>(validTabs), [validTabs]);

  const getTabFromSearch = useCallback((search: string): T | null => {
    const tab = new URLSearchParams(search).get(paramName);
    return tab && validSet.has(tab) ? (tab as T) : null;
  }, [paramName, validSet]);

  const [activeTab, setActiveTab] = useState<T>(() => getTabFromSearch(location.search) || defaultTab);

  useEffect(() => {
    const tabFromUrl = getTabFromSearch(location.search);
    const nextTab = tabFromUrl || defaultTab;
    if (nextTab !== activeTab) setActiveTab(nextTab);
  }, [activeTab, defaultTab, getTabFromSearch, location.search]);

  const setTab = (value: T) => {
    setActiveTab(value);

    const params = new URLSearchParams(location.search);
    if (value === defaultTab) {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }

    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      {
        replace: true,
        state: location.state,
      },
    );
  };

  return [activeTab, setTab] as const;
}
