"use client";
import { useEffect, useState, useCallback } from "react";
import { Service, ServiceCategory } from "@/types";
import { Zap, Tag } from "lucide-react";
import Link from "next/link";

export default function UserServicesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, svcRes] = await Promise.all([
        fetch("/api/categories", { credentials: "include" }),
        fetch("/api/services", { credentials: "include" }),
      ]);
      const [catData, svcData] = await Promise.all([catRes.json(), svcRes.json()]);
      setCategories(catData.categories || []);
      const list: Service[] = svcData.services || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setServices(list);
    } catch (err) {
      console.error("Services page fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getGroupedServices = () => {
    const grouped: Record<string, Service[]> = {};
    const uncategorized: Service[] = [];

    services.forEach((svc) => {
      if (svc.categoryId && categories.some(c => c.id === svc.categoryId)) {
        if (!grouped[svc.categoryId]) grouped[svc.categoryId] = [];
        grouped[svc.categoryId].push(svc);
      } else {
        uncategorized.push(svc);
      }
    });

    return { grouped, uncategorized };
  };

  const { grouped, uncategorized } = getGroupedServices();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const RenderCategoryBlock = ({ categoryName, categoryLogo, svcList }: { categoryName: string, categoryLogo?: string, svcList: Service[] }) => {
    if (svcList.length === 0) return null;
    const isUrl = categoryLogo?.startsWith("http://") || categoryLogo?.startsWith("https://");
    return (
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5 pb-3 border-b border-outline-variant/30">
          {categoryLogo ? (
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
              {isUrl ? (
                <img src={categoryLogo} alt={categoryName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base leading-none">{categoryLogo}</span>
              )}
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center">
              <Tag className="w-4 h-4 text-on-surface-variant" />
            </div>
          )}
          <h2 className="font-headline text-2xl font-bold text-[#134235]">{categoryName}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {svcList.map((svc) => (
            <Link key={svc.id} href={`/user/services/${svc.id}`}
              className="group relative bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow card-hover transition-all duration-200 aspect-[3/4] flex flex-col">
              {/* Full-bleed logo */}
              <div className="flex-1 relative overflow-hidden">
                {svc.icon ? (
                  <img
                    src={svc.icon}
                    alt={svc.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1EE] to-[#C5DDD5] flex items-center justify-center">
                    <Zap className="w-12 h-12 text-primary/50 group-hover:text-primary transition-colors duration-200" />
                  </div>
                )}
              </div>
              {/* Name strip */}
              <div className="h-10 flex items-center justify-center px-2 bg-white border-t border-black/[0.05]">
                <p className="font-manrope font-bold text-[#134235] text-[11px] text-center leading-tight group-hover:text-primary transition-colors line-clamp-1 w-full">{svc.name}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Services Directory</h1>
          <p className="text-on-surface-variant font-body text-lg">Select a service provider to initiate a transaction.</p>
        </div>
      </section>

      {services.length === 0 && !loading ? (
        <div className="border-2 border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center">
          <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-on-surface-variant" />
          </div>
          <p className="text-on-surface font-bold font-manrope text-lg mb-1">No services active right now</p>
          <p className="text-sm text-on-surface-variant">Please check back later or contact your administrator.</p>
        </div>
      ) : (
        <>
          {categories.map((cat) => (
            <RenderCategoryBlock key={cat.id} categoryName={cat.name} categoryLogo={cat.logo} svcList={grouped[cat.id] || []} />
          ))}
          <RenderCategoryBlock categoryName="Uncategorized Services" svcList={uncategorized} />
        </>
      )}
    </div>
  );
}
