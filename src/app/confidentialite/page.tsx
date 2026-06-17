import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment Quatools Hub Notification traite les données personnelles : rôles, données collectées, bases légales, durées, sous-traitants et droits des personnes.",
}

const LAST_UPDATE = "17 juin 2026"

/** Section de document légal : eyebrow mono + titre Fraunces + contenu. */
function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mono-label mb-1 text-[color:var(--qt-copper-500)]">{n}</div>
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  )
}

export default function ConfidentialitePage() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mono-label">Document légal</div>
      <h1 className="mt-1 font-serif text-[30px] font-medium leading-tight">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {LAST_UPDATE}. Ce document décrit le traitement des données personnelles dans le
        cadre du service <strong>Quatools Hub Notification</strong> (le « Service »).
      </p>

      <Section n="1" title="Rôles : qui est responsable de quoi">
        <p>
          Le Service permet à des organisations clientes (clubs, associations, structures — le « Club ») d&apos;envoyer
          à leurs membres des notifications déclenchées par des événements de leurs propres applications.
        </p>
        <p>
          Pour les données des membres, <strong>chaque Club est responsable de traitement</strong> : c&apos;est lui qui
          décide quelles notifications sont envoyées et sur quelle base. <strong>Quatools agit comme sous-traitant</strong>
          {" "}au sens de l&apos;article 28 du RGPD : Quatools traite ces données pour le compte et sur instruction du Club,
          via le Service.
        </p>
        <p>
          Pour les comptes d&apos;administration (les personnes qui configurent le Service côté Club) et le
          fonctionnement technique du Service lui-même, Quatools agit comme responsable de traitement.
        </p>
        <p className="rounded-lg border border-[color:var(--qt-sable-300,#DAD4C6)] bg-secondary/40 p-3 text-xs text-muted-foreground">
          Éditeur du Service : Alexandre QUAGLIERI, entrepreneur individuel — SIREN 520&nbsp;181&nbsp;520,
          SIRET 520&nbsp;181&nbsp;520&nbsp;00039, TVA FR36520181520, RCS Nîmes — siège social :
          161 chemin de l&apos;Estanet, 30840 Meynes (France). Contact données personnelles : alexandre@quatools.fr.
        </p>
      </Section>

      <Section n="2" title="Données traitées et leur origine">
        <p>Selon votre usage, le Service traite :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Identité &amp; identifiants</strong> : nom ou pseudonyme, identifiant Discord, adresse email, langue.</li>
          <li><strong>Comptes de réception</strong> que vous ajoutez vous-même (ex. une adresse email personnelle).</li>
          <li><strong>Préférences de notification</strong> : activation/désactivation par notification, « ne pas déranger », compte de réception par défaut, refus (opt-out).</li>
          <li><strong>Journaux d&apos;envoi</strong> : événement concerné, canal, destination résolue, statut (envoyé/échec), date, et le contenu du message envoyé (pour vous permettre de consulter ce que vous avez reçu).</li>
          <li><strong>Données de compte admin</strong> : identité issue de la connexion Discord, organisations administrées.</li>
        </ul>
        <p>Ces données proviennent : (a) de votre connexion via Discord ; (b) des informations transmises par l&apos;application du Club lors d&apos;un événement (ex. votre email ou identifiant Discord) ; (c) de ce que vous saisissez vous-même dans le Service.</p>
      </Section>

      <Section n="3" title="Finalités et bases légales">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Acheminer les notifications</strong> décidées par le Club vers ses membres — base légale définie par le Club (intérêt légitime à informer ses membres, exécution d&apos;un contrat, ou consentement selon les cas).</li>
          <li><strong>Vous donner la maîtrise</strong> (choix des notifications, du compte de réception, désabonnement) — intérêt légitime et respect de vos droits.</li>
          <li><strong>Fournir et sécuriser le Service</strong> (authentification, journaux techniques, prévention des abus) — intérêt légitime de Quatools.</li>
        </ul>
        <p>Le Service ne réalise aucun profilage publicitaire et ne vend aucune donnée.</p>
      </Section>

      <Section n="4" title="Destinataires et sous-traitants ultérieurs">
        <p>Pour fournir le Service, Quatools recourt à des prestataires techniques (sous-traitants ultérieurs), chacun limité à ce qui est nécessaire :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Scaleway</strong> (France) — hébergement de l&apos;application et envoi des emails (service d&apos;emails transactionnels).</li>
          <li><strong>Supabase</strong> — base de données et authentification, hébergement en Union européenne.</li>
          <li><strong>Discord</strong> (Discord Inc., États-Unis) — connexion (OAuth) et envoi des messages Discord (salon ou message privé). Ce transfert hors UE est encadré par les garanties appropriées (clauses contractuelles types).</li>
        </ul>
        <p>Vos données ne sont jamais transmises à d&apos;autres tiers à des fins commerciales.</p>
      </Section>

      <Section n="5" title="Durées de conservation">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Préférences et comptes de réception : tant que votre compte / lien avec le Club est actif.</li>
          <li>Journaux d&apos;envoi : 12 mois à des fins de suivi et de preuve d&apos;acheminement.</li>
          <li>Données de compte : supprimées à la suppression du compte, sauf obligation légale de conservation.</li>
        </ul>
      </Section>

      <Section n="6" title="Vos droits">
        <p>
          Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, d&apos;opposition, de limitation et de
          portabilité, ainsi que du droit de définir des directives sur le sort de vos données après votre décès.
        </p>
        <p>
          Vous pouvez exercer une grande partie de ces droits directement dans le Service : choisir vos notifications,
          changer de compte de réception, activer « ne pas déranger », ou vous désabonner en un clic depuis un email reçu.
          Pour les autres demandes, contactez le Club concerné (responsable de traitement) ou Quatools à alexandre@quatools.fr —
          Quatools relaiera la demande au Club le cas échéant.
        </p>
        <p>
          Vous pouvez aussi introduire une réclamation auprès de la CNIL (
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="underline">www.cnil.fr</a>).
        </p>
      </Section>

      <Section n="7" title="Sécurité">
        <p>
          Quatools met en œuvre des mesures techniques et organisationnelles adaptées : chiffrement des échanges (HTTPS),
          cloisonnement des données par organisation, contrôle d&apos;accès, et secrets stockés de façon protégée. Aucun
          système n&apos;étant infaillible, ces mesures visent un niveau de sécurité adapté au risque.
        </p>
      </Section>

      <Section n="8" title="Cookies">
        <p>
          Le Service n&apos;utilise que des cookies strictement nécessaires à votre connexion et à la sécurité de votre
          session. Aucun cookie publicitaire ni de mesure d&apos;audience tierce n&apos;est déposé.
        </p>
      </Section>

      <Section n="9" title="Contact et modifications">
        <p>
          Pour toute question relative à cette politique : alexandre@quatools.fr. Cette politique peut être mise à jour ; la date
          de dernière mise à jour figure en haut de page.
        </p>
        <p className="text-muted-foreground">
          Voir aussi nos <Link href="/cgu" className="underline">Conditions générales d&apos;utilisation</Link>.
        </p>
      </Section>
    </div>
  )
}
