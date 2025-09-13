Frontend/Backend Alignment Report

Summary
- Purpose: align DB schemas and API payloads with the frontend spec.
- Actions taken: added a migration script to add missing columns and tables without breaking existing data; updated auth and subscription endpoints to match contracts.

Tables updated (added columns)
- users: profession, experience
- subscriptions: plan, canceled_at
- entreprises: raison_sociale, wilaya, numero_registre_commerce, annees_experience, specialites, contact_name, logo_url, secteur, location, site, registre_url, attestation_url, references_url, owner_user_id
- offres: company_id, contract_type, experience_required, wilaya, salary_min, salary_max, currency, is_active, requirements
- candidatures: first_name, last_name, email, phone, photos_urls
- services: icon
- devis: timeline, budget
- produits: voltage, is_active

New tables created
- offer_applications: applications to offers, matching the frontend model
- payments: generic payment tracking

Key API alignment notes
- Auth
  - POST /auth/register now accepts { firstName, lastName, email, phone, profession, experience, password }. It still accepts legacy { nom, prenom, telephone }.
  - GET /auth/profile now returns the user DTO expected by the frontend and derives subscriptionStatus and subscriptionEndDate from latest subscription.
- Abonnement
  - POST /abonnement/souscrire accepts { plan: 'mensuel' | 'trimestriel' } and returns the created subscription DTO.
  - GET /abonnement/mon-abonnement returns { status: 'premium'|'free'|'expired', startsAt?, endsAt? }.
  - POST /abonnement/annuler returns 204 and sets canceled_at.
- Offres
  - DB supports required fields. Routes still return legacy shapes; mapping to the new DTO may be added next.
- Services & Devis
  - DB supports optional icon/timeline/budget. Existing endpoints continue to work; DTO mapping can be added if needed.

Backend-only or divergent tables/endpoints (to flag to frontend)
- partenaires, partenaire_services: separate partner catalogue; frontend expects companies with status='approved'. Consider using entreprises instead and deprecate partenaires.
- candidatures/diplomes currently model “recrutement” and are reused in some places for offers; frontend expects a dedicated offer_applications table (now created).
- entreprises legacy fields (siret, code_postal, type_activite, capacite_production, certifications, document_url/_key) are kept for backward compatibility but not required by frontend.
- produits has both disponibilite and is_active (new). Frontend should use isActive; backend keeps disponibilite for legacy.

Open points / next steps
- Offres routes: expose public GET /offres with the new DTO (contractType, wilaya, experienceRequired, salary/currency, isActive). Update POST/PUT to accept these keys directly.
- Sous-traitance routes: accept new company payload (raison_sociale, wilaya, numero_registre_commerce, annees_experience, specialites[]) and map files to registreUrl/attestationUrl/referencesUrl.
- Offres-abonnes: switch to offer_applications for listing applicants by offer.
- Payments: wire up flows if payment is used to activate plans.

