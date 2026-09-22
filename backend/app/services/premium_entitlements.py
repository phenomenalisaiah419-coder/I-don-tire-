"""Central PHENOVA Premium feature gate definitions.

All Premium checks consume a server-authoritative entitlement set. Owner access is
therefore treated exactly like a legitimate Premium entitlement, not as a billing
bypass.
"""
PREMIUM_FEATURES={
    "ai_edit_premium",
    "1080p_export",
    "unlimited_corrections",
    "premium_templates",
    "advanced_effects",
    "advanced_transitions",
}

def feature_allowed(entitlements:set[str], feature:str)->bool:
    if feature not in PREMIUM_FEATURES:
        return True
    return "PHENOVA_PREMIUM" in entitlements

def premium_summary(entitlements:set[str])->dict:
    premium="PHENOVA_PREMIUM" in entitlements
    return {"premium":premium,"features":{f:premium for f in PREMIUM_FEATURES}}
