// @ts-nocheck
/* Portado do App Controle (Planejamento 2.0 original). */
import { useState, useEffect } from "react";
import { supabase } from "@/planejamento-v2-original/supabaseClient";
import { useRealtime } from "./useRealtime";

interface CompanySettings {
  id: string;
  logo_url: string | null;
  company_name: string | null;
}

export function useCompanyLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCompanySettings = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching company settings:", error);
    } else if (data) {
      setLogoUrl(data.logo_url);
      setCompanyName(data.company_name);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  // Real-time updates
  useRealtime({
    table: "company_settings",
    onChange: fetchCompanySettings,
  });

  return { logoUrl, companyName, isLoading, refetch: fetchCompanySettings };
}
