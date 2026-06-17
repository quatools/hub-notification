import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description:
    "Conditions générales d'utilisation du service Quatools Hub Notification : objet, accès, obligations, sous-traitance RGPD, responsabilité et droit applicable.",
}

const LAST_UPDATE = "17 juin 2026"

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mono-label mb-1 text-[color:var(--qt-copper-500)]">{n}</div>
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85">{children}</div>
    </section>
  )
}

export default function CguPage() {
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="mono-label">Document légal</div>
      <h1 className="mt-1 font-serif text-[30px] font-medium leading-tight">Conditions générales d&apos;utilisation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Dernière mise à jour : {LAST_UPDATE}. Les présentes conditions régissent l&apos;utilisation du service
        <strong> Quatools Hub Notification</strong> (le « Service »), édité par Alexandre QUAGLIERI, entrepreneur
        individuel — SIREN 520&nbsp;181&nbsp;520, RCS Nîmes, siège 161 chemin de l&apos;Estanet, 30840 Meynes —
        (« Quatools »).
      </p>

      <Section n="1" title="Objet">
        <p>
          Le Service permet à une organisation cliente (club, association, structure — le « Client ») de centraliser et
          d&apos;acheminer vers ses membres (les « Membres ») des notifications déclenchées par des événements de ses
          applications, sur différents canaux (salon Discord, message privé Discord, email).
        </p>
        <p>
          L&apos;utilisation du Service implique l&apos;acceptation pleine et entière des présentes conditions par le Client
          et par toute personne utilisant le Service.
        </p>
      </Section>

      <Section n="2" title="Accès et compte">
        <p>
          L&apos;accès se fait via une connexion Discord. Le Client est responsable de la confidentialité des accès, des
          clés d&apos;API et des secrets (jeton de bot, clés d&apos;envoi) utilisés pour relier ses applications au Service.
        </p>
      </Section>

      <Section n="3" title="Description du service">
        <p>
          Le Service met à disposition : la configuration de canaux et de notifications, des modèles de messages, l&apos;envoi
          effectif des notifications, un historique d&apos;envoi, et un espace permettant à chaque Membre de gérer ses
          préférences (choix des notifications, compte de réception, « ne pas déranger », désabonnement).
        </p>
      </Section>

      <Section n="4" title="Obligations du Client">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>N&apos;utiliser le Service que pour des communications <strong>licites</strong> et disposer d&apos;une <strong>base légale valable</strong> pour notifier ses Membres (RGPD).</li>
          <li><strong>Informer ses Membres</strong> du traitement de leurs données et de leurs droits (notamment via sa propre politique de confidentialité).</li>
          <li>Ne pas envoyer de contenu illicite, trompeur, ou de prospection non sollicitée en violation de la réglementation applicable.</li>
          <li>Sécuriser ses secrets et signaler sans délai toute compromission.</li>
          <li>Être responsable du contenu des messages qu&apos;il configure et déclenche.</li>
        </ul>
      </Section>

      <Section n="5" title="Données personnelles — sous-traitance (article 28 RGPD)">
        <p>
          Pour les données des Membres, le <strong>Client est responsable de traitement</strong> et <strong>Quatools est
          sous-traitant</strong>. Quatools s&apos;engage à :
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>ne traiter les données que sur instruction documentée du Client et pour les seules finalités du Service ;</li>
          <li>garantir la confidentialité (personnes habilitées tenues à la confidentialité) ;</li>
          <li>mettre en œuvre des mesures de sécurité adaptées ;</li>
          <li>n&apos;avoir recours qu&apos;à des sous-traitants ultérieurs présentant des garanties suffisantes (voir la <Link href="/confidentialite" className="underline">Politique de confidentialité</Link>), et informer le Client de tout changement ;</li>
          <li>aider le Client à répondre aux demandes d&apos;exercice de droits et à ses obligations de sécurité/notification de violation ;</li>
          <li>au terme du contrat, supprimer ou restituer les données, sauf obligation légale de conservation.</li>
        </ul>
        <p>
          Les catégories de données, finalités, durées et sous-traitants ultérieurs sont décrits dans la
          {" "}<Link href="/confidentialite" className="underline">Politique de confidentialité</Link>, qui fait partie
          intégrante des présentes.
        </p>
      </Section>

      <Section n="6" title="Disponibilité et maintenance">
        <p>
          Quatools s&apos;efforce d&apos;assurer la disponibilité du Service mais le fournit « en l&apos;état », sans
          garantie de disponibilité ininterrompue. Des interruptions pour maintenance ou cause externe peuvent survenir.
          Aucun engagement de niveau de service (SLA) n&apos;est consenti à ce stade.
        </p>
      </Section>

      <Section n="7" title="Propriété intellectuelle">
        <p>
          Le Service, sa marque et ses composants restent la propriété de Quatools ou de ses concédants. Aucun droit
          n&apos;est cédé au Client au-delà du droit d&apos;utiliser le Service conformément aux présentes.
        </p>
      </Section>

      <Section n="8" title="Responsabilité">
        <p>
          Quatools ne saurait être tenu responsable du contenu des notifications décidées et déclenchées par le Client, ni
          des conséquences d&apos;un usage non conforme du Service. La responsabilité de Quatools est limitée aux dommages
          directs et prévisibles, dans les limites permises par la loi.
        </p>
      </Section>

      <Section n="9" title="Suspension et résiliation">
        <p>
          Quatools peut suspendre l&apos;accès en cas d&apos;usage non conforme, d&apos;atteinte à la sécurité ou de risque
          pour des tiers. Chaque partie peut mettre fin à l&apos;utilisation du Service ; les conséquences sur les données
          sont régies par la section 5 et la Politique de confidentialité.
        </p>
      </Section>

      <Section n="10" title="Modifications">
        <p>
          Quatools peut faire évoluer les présentes conditions. La version applicable est celle en ligne ; la date de
          dernière mise à jour figure en haut de page.
        </p>
      </Section>

      <Section n="11" title="Droit applicable et litiges">
        <p>
          Les présentes sont régies par le <strong>droit français</strong>. À défaut de résolution amiable, les tribunaux
          compétents sont ceux du ressort de <strong>Nîmes</strong>, sous réserve des règles d&apos;ordre public
          applicables.
        </p>
        <p className="text-muted-foreground">
          Voir aussi notre <Link href="/confidentialite" className="underline">Politique de confidentialité</Link>.
        </p>
      </Section>
    </div>
  )
}
