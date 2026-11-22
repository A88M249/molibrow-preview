# -*- coding: utf-8 -*-
"""Local-SEO area pages for Akershus around Eidsvoll (Norwegian only), plus the privacy page.

Rules for this file (so the pages stay useful, not doorway pages):
- Only say things that are true for every reader: the studio's address, free parking, prices, how a visit works.
- Place facts are limited to well-known geography (which municipality a place belongs to). No driving times or
  distances are stated – the page links to Google Maps for directions from the reader's own address.
- Every page has its own intro, its own local paragraph and its own FAQ wording. Add a new place only if clients
  actually come from there (check Search Console / Timma), and prune pages that never get impressions.
"""

AREA_ORDER = ["eidsvoll", "raholt", "eidsvoll-verk", "minnesund", "hurdal",
              "ullensaker-jessheim", "nes-arnes", "nannestad", "gjerdrum"]

# key -> dict. 'kind': 'home' (studio's own town) | 'same' (same municipality) | 'near' (nearby municipality)
AREAS = {
"eidsvoll": dict(
    name="Eidsvoll", slug="eidsvoll", kind="home", muni="Eidsvoll kommune",
    title="Bryn og vippeløft i Eidsvoll | Molí Brow Studio",
    desc="Molí Brow Studio ligger i Sundgata 7 i Eidsvoll. Brynslaminering, koreansk vippeløft og signaturbryn hos Lina – gratis parkering rett utenfor.",
    h1="Bryn og vippeløft i Eidsvoll",
    intro="Molí Brow Studio ligger midt i Eidsvoll, i Sundgata 7, 3. etasje. Her får du brynslaminering, koreansk vippeløft, signaturbryn, forming og voksing av Lina – i et rolig og lyst studio der timen er din.",
    local=["Bor du i Eidsvoll slipper du å reise inn til byen for en profesjonell bryn- og vippebehandling. Studioet har gratis parkering rett utenfor, og hver time starter med en konsultasjon der vi ser på hårene og ønskene dine.",
           "Mange kunder kombinerer bryn og vipper i én time, så du slipper to avtaler. Se kombinasjoner og faste priser nedenfor."],
    faq=[("Hvor ligger Molí Brow Studio i Eidsvoll?", "Studioet ligger i Sundgata 7, 3. etasje, 2080 Eidsvoll. Det er gratis parkering rett utenfor."),
         ("Hva koster brynslaminering i Eidsvoll?", "Brynslaminering koster 1000 kr (90 min), eller 900 kr uten farge (75 min)."),
         ("Hvordan bestiller jeg time i Eidsvoll?", "Du bestiller online. Velg behandling og et tidspunkt som passer – du får bekreftelse på SMS eller e-post.")],
),
"raholt": dict(
    name="Råholt", slug="raholt", kind="same", muni="Eidsvoll kommune",
    title="Brynslaminering og vippeløft for deg på Råholt | Molí Brow Studio",
    desc="Bor du på Råholt? Molí Brow Studio ligger i Eidsvoll, i samme kommune. Brynslaminering, vippeløft og signaturbryn fra 350 kr – gratis parkering.",
    h1="Bryn og vippeløft for deg på Råholt",
    intro="Råholt hører til Eidsvoll kommune, og Molí Brow Studio ligger i Sundgata 7 i Eidsvoll – så du trenger ikke reise ut av kommunen for en behandling hos Lina.",
    local=["Timene hos Lina er rolige og personlige: bare du og Lina, uten stress, og hvert steg forklares underveis. Det er gratis parkering rett utenfor studioet.",
           "Mange fra Råholt velger en kombinasjon av vippeløft og brynbehandling, slik at alt er gjort i én time."],
    faq=[("Tar dere imot kunder fra Råholt?", "Ja – Råholt ligger i Eidsvoll kommune, og studioet i Sundgata 7 tar imot kunder fra hele Eidsvoll og omegn."),
         ("Finnes det parkering ved studioet?", "Ja, det er gratis parkering rett utenfor Sundgata 7."),
         ("Hvilke behandlinger kan jeg bestille?", "Brynslaminering, koreansk vippeløft, signaturbryn, forming av bryn, farging av vipper og voksing – og kombinasjoner av dem.")],
),
"eidsvoll-verk": dict(
    name="Eidsvoll Verk", slug="eidsvoll-verk", kind="same", muni="Eidsvoll kommune",
    title="Bryn og vippeløft for deg på Eidsvoll Verk | Molí Brow Studio",
    desc="Fra Eidsvoll Verk til Molí Brow Studio i Eidsvoll: brynslaminering, koreansk vippeløft og signaturbryn med faste priser og gratis parkering.",
    h1="Bryn og vippeløft for deg på Eidsvoll Verk",
    intro="Eidsvoll Verk ligger i Eidsvoll kommune. Molí Brow Studio ligger i Sundgata 7 i Eidsvoll, og tar imot kunder fra Eidsvoll Verk og resten av kommunen.",
    local=["Hos Molí Brow Studio er prisene faste og oppgitt på forhånd, og alle behandlinger utføres av Lina. Vi starter alltid med en konsultasjon, fordi for eksempel brynslaminering ikke passer for alle.",
           "Studioet ligger i 3. etasje, og du kan parkere gratis rett utenfor."],
    faq=[("Er det langt fra Eidsvoll Verk til studioet?", "Studioet ligger i Sundgata 7 i Eidsvoll, i samme kommune som Eidsvoll Verk. Bruk veibeskrivelsen i Google Maps for å se ruten fra der du bor."),
         ("Hva koster vippeløft?", "Vippeløft og farging av vipper koster 1100 kr (90 min). Vippeløft uten farge koster 1000 kr (60 min)."),
         ("Hvor lenge varer et vippeløft?", "Et vippeløft varer vanligvis 6–8 uker.")],
),
"minnesund": dict(
    name="Minnesund", slug="minnesund", kind="same", muni="Eidsvoll kommune",
    title="Bryn og vippeløft for deg fra Minnesund | Molí Brow Studio",
    desc="Kommer du fra Minnesund? Molí Brow Studio i Eidsvoll tilbyr brynslaminering, koreansk vippeløft og signaturbryn i et rolig studio med gratis parkering.",
    h1="Bryn og vippeløft for deg fra Minnesund",
    intro="Minnesund ligger i Eidsvoll kommune, og mange fra Minnesund-området kan nå Molí Brow Studio i Sundgata 7 i Eidsvoll uten å forlate kommunen.",
    local=["Gjør timen til en pause fra hverdagen: kundene våre beskriver den som nesten som å være på spa. Du får ro, tid og et naturlig resultat formet etter ansiktet ditt – ikke etter en mal.",
           "Planlegger du å kjøre til Eidsvoll uansett? Da kan du enkelt kombinere bryn og vipper i én time."],
    faq=[("Tar dere imot kunder fra Minnesund?", "Ja, studioet tar imot kunder fra hele Eidsvoll kommune, inkludert Minnesund."),
         ("Hvor parkerer jeg?", "Det er gratis parkering rett utenfor studioet i Sundgata 7."),
         ("Hva er forskjellen på brynslaminering og signaturbryn?", "Brynslaminering løfter og setter hårene for et mykere, fyldigere uttrykk. Signaturbryn handler om oppmåling, forming og farge tilpasset ansiktet ditt.")],
),
"hurdal": dict(
    name="Hurdal", slug="hurdal", kind="near", muni="Hurdal kommune",
    title="Bryn og vippeløft for deg i Hurdal | Molí Brow Studio Eidsvoll",
    desc="Bor du i Hurdal? Molí Brow Studio i Eidsvoll tilbyr brynslaminering, koreansk vippeløft og signaturbryn med faste priser og gratis parkering.",
    h1="Bryn og vippeløft for deg i Hurdal",
    intro="Hurdal er nabokommune til Eidsvoll. Molí Brow Studio ligger i Sundgata 7 i Eidsvoll og tar imot kunder fra Hurdal som vil ha naturlige bryn og vipper i rolige omgivelser.",
    local=["Kommer du fra Hurdal er det praktisk å samle behandlingene: bryn og vipper kan gjøres i én time, så du slipper å bestille flere turer.",
           "Alle priser er faste og oppgitt i NOK, og du får vite hva som skjer – og hvorfor – gjennom hele timen."],
    faq=[("Tar dere imot kunder fra Hurdal?", "Ja. Hurdal er nabokommune til Eidsvoll, og vi tar gjerne imot kunder derfra."),
         ("Kan jeg få bryn og vipper gjort samtidig?", "Ja – kombinasjoner koster fra 1400 kr, for eksempel vippeløft og brynslaminering for 1750 kr (150 min)."),
         ("Er det gratis parkering?", "Ja, rett utenfor studioet i Sundgata 7.")],
),
"ullensaker-jessheim": dict(
    name="Ullensaker og Jessheim", slug="ullensaker-jessheim", kind="near", muni="Ullensaker kommune",
    title="Vippeløft og bryn for deg fra Jessheim og Ullensaker | Molí Brow Studio",
    desc="Fra Jessheim, Kløfta og Ullensaker til Molí Brow Studio i Eidsvoll: koreansk vippeløft, brynslaminering og signaturbryn. Fast pris, gratis parkering.",
    h1="Vippeløft og bryn for deg fra Jessheim og Ullensaker",
    intro="Ullensaker – med Jessheim, Kløfta og Gardermoen – er nabokommune til Eidsvoll. Molí Brow Studio ligger i Sundgata 7 i Eidsvoll, og E6 gir deg en enkel vei hit.",
    local=["Mange som bor i Ullensaker leter etter en brynstylist med tid til å gjøre ting riktig. Hos Lina starter hver time med en konsultasjon, og du får et resultat som passer ansiktet ditt.",
           "Er du på vei forbi, eller vil du ha en rolig time utenfor hverdagen? Vi har gratis parkering rett utenfor."],
    faq=[("Tar dere imot kunder fra Jessheim og Ullensaker?", "Ja. Ullensaker er nabokommune til Eidsvoll, og kunder fra Jessheim, Kløfta og Gardermoen er velkomne."),
         ("Hvilken vei tar jeg fra Jessheim?", "E6 går mellom Ullensaker og Eidsvoll. Bruk Google Maps for veibeskrivelse til Sundgata 7 fra der du bor."),
         ("Hva koster en kombinasjon av vippeløft og bryn?", "Kombinasjoner koster fra 1400 kr. Vippeløft og brynslaminering koster 1750 kr (150 min).")],
),
"nes-arnes": dict(
    name="Nes og Årnes", slug="nes-arnes", kind="near", muni="Nes kommune",
    title="Bryn og vippeløft for deg fra Nes og Årnes | Molí Brow Studio",
    desc="Kommer du fra Nes eller Årnes i Akershus? Molí Brow Studio i Eidsvoll tilbyr brynslaminering, koreansk vippeløft og signaturbryn. Faste priser.",
    h1="Bryn og vippeløft for deg fra Nes og Årnes",
    intro="Har du kjøreavstand fra Nes eller Årnes i Akershus, er Molí Brow Studio i Eidsvoll et godt valg for deg som vil ha naturlige bryn og vipper formet etter deg.",
    local=["Hos Lina er hver behandling tilpasset: vi ser på hårene og ønskene dine først, og avtaler form og uttrykk sammen. Du kan velge fluffy eller mer strukturerte bryn.",
           "Studioet ligger i 3. etasje i Sundgata 7, med gratis parkering rett utenfor."],
    faq=[("Tar dere imot kunder fra Nes og Årnes?", "Ja, vi tar imot kunder fra hele Akershus-området rundt Eidsvoll, også fra Nes og Årnes."),
         ("Hvor lenge varer brynslaminering?", "Brynslaminering varer vanligvis 4–6 uker."),
         ("Hvordan avbestiller jeg?", "Avbestill senest 24 timer før timen. Senere avbestilling eller uteblivelse kan belastes med 100 % av prisen.")],
),
"nannestad": dict(
    name="Nannestad", slug="nannestad", kind="near", muni="Nannestad kommune",
    title="Bryn og vippeløft for deg i Nannestad | Molí Brow Studio Eidsvoll",
    desc="Bor du i Nannestad? Molí Brow Studio i Eidsvoll tilbyr koreansk vippeløft, brynslaminering og signaturbryn – fast pris og gratis parkering.",
    h1="Bryn og vippeløft for deg i Nannestad",
    intro="Nannestad er nabokommune til Eidsvoll. Molí Brow Studio ligger i Sundgata 7 i Eidsvoll og tar imot kunder fra Nannestad som vil ha en rolig, personlig behandling.",
    local=["Når du bestiller hos oss vet du prisen på forhånd, og tiden er satt av til deg alene. Vippeløft, brynslaminering, signaturbryn, forming og voksing utføres alt av Lina.",
           "Kombiner gjerne flere behandlinger i samme time – da blir turen til Eidsvoll mer verdt."],
    faq=[("Tar dere imot kunder fra Nannestad?", "Ja. Nannestad er nabokommune til Eidsvoll, og vi tar gjerne imot kunder derfra."),
         ("Hva koster signaturbryn?", "Signaturbryn – farge og forming – koster 650 kr og tar 60 minutter."),
         ("Må jeg forberede meg på noe?", "Unngå selvbruning og hudpleie med aktive ingredienser i 7 dager før timen, og kom uten maskara til vippebehandlinger.")],
),
"gjerdrum": dict(
    name="Gjerdrum", slug="gjerdrum", kind="near", muni="Gjerdrum kommune",
    title="Bryn og vippeløft for deg fra Gjerdrum | Molí Brow Studio Eidsvoll",
    desc="Fra Gjerdrum til Molí Brow Studio i Eidsvoll: brynslaminering, koreansk vippeløft og signaturbryn. Faste priser, rolig time og gratis parkering.",
    h1="Bryn og vippeløft for deg fra Gjerdrum",
    intro="Bor du i Gjerdrum og leter etter en brynstylist med fokus på kvalitet og detaljer? Molí Brow Studio i Eidsvoll tar imot kunder fra hele Akershus-området rundt oss.",
    local=["Lina er sertifisert brynstylist siden 2024 og setter høye krav til både produktene hun bruker og utførelsen. Timen er rolig, og du får rådene dine for etterpleie på timen.",
           "Se prisene våre under – alle er faste, og du kan kombinere bryn og vipper for å spare tid."],
    faq=[("Tar dere imot kunder fra Gjerdrum?", "Ja, vi tar imot kunder fra hele Akershus-området rundt Eidsvoll, inkludert Gjerdrum."),
         ("Hva er aldersgrensen?", "Aldersgrensen er 16 år."),
         ("Finnes det gavekort?", "Ja – gavekort på 500 kr, 750 kr eller valgfritt beløp.")],
),
}

HUB = dict(
    title="Bryn og vippeløft i Akershus – Eidsvoll og omegn | Molí Brow Studio",
    desc="Molí Brow Studio i Eidsvoll tar imot kunder fra hele Akershus-området rundt: Råholt, Minnesund, Hurdal, Jessheim, Nes, Nannestad og Gjerdrum.",
    h1="Bryn og vippeløft i Akershus",
    lead="Vi holder til i Eidsvoll og tar imot kunder fra hele området rundt – med faste priser, rolige timer og gratis parkering rett utenfor.",
    body=["Molí Brow Studio ligger i Sundgata 7, 3. etasje, i Eidsvoll. Studioet drives av Lina, sertifisert brynstylist siden 2024, og er et lite, rolig rom der timen er din.",
          "Her ser du hvilke steder vi oftest får kunder fra. Finner du ikke ditt sted? Du er likevel velkommen – bruk Google Maps for å se ruten til studioet."],
)

PRIVACY = dict(
    title=("Personvern – Molí Brow Studio", "Privacy – Molí Brow Studio"),
    desc=("Slik behandler Molí Brow Studio personopplysninger når du bestiller time.", "How Molí Brow Studio handles personal data when you book an appointment."),
    h1=("Personvern", "Privacy"),
    sections=[
        (("Hvem er behandlingsansvarlig?", "Who is the data controller?"),
         ("Molí Brow Studio, Sundgata 7, 3. etasje, 2080 Eidsvoll. Kontakt oss på molibrowstudio@gmail.com.",
          "Molí Brow Studio, Sundgata 7, 3rd floor, 2080 Eidsvoll, Norway. Contact us at molibrowstudio@gmail.com.")),
        (("Hvilke opplysninger samler vi inn?", "What data do we collect?"),
         ("Når du bestiller time oppgir du navn, telefonnummer og/eller e-post, ønsket behandling og tidspunkt, og eventuelt en kommentar. Nettsiden bruker ikke analyse- eller markedsføringsinfokapsler.",
          "When you book you provide your name, phone number and/or email, the treatment and time you want, and optionally a comment. This website does not use analytics or marketing cookies.")),
        (("Hva brukes opplysningene til?", "What is the data used for?"),
         ("Kun til å gjennomføre og bekrefte timen din, sende påminnelser og eventuelt kontakte deg om timen. Behandlingsgrunnlaget er at du ber om en avtale (GDPR art. 6 nr. 1 b).",
          "Only to carry out and confirm your appointment, send reminders and contact you about it if needed. The legal basis is that you ask for an appointment (GDPR art. 6(1)(b)).")),
        (("Hvem får tilgang?", "Who has access?"),
         ("Bestillingen håndteres i et bookingsystem levert av Sprocket 3PL AS (Spokes), som er databehandler for oss. Eventuelle bestillinger gjort via Timma håndteres av Timma. Vi selger ikke opplysningene dine.",
          "Bookings are handled in a booking system provided by Sprocket 3PL AS (Spokes), which acts as our data processor. Any bookings made via Timma are handled by Timma. We do not sell your data.")),
        (("Dine rettigheter", "Your rights"),
         ("Du kan be om innsyn i, retting av eller sletting av opplysningene dine ved å sende en e-post til oss. Du kan klage til Datatilsynet (datatilsynet.no).",
          "You can ask for access to, correction of or deletion of your data by emailing us. You can lodge a complaint with the Norwegian Data Protection Authority (datatilsynet.no).")),
    ],
)

BOOK = dict(
    title=("Bestill time – Molí Brow Studio Eidsvoll", "Book an appointment – Molí Brow Studio Eidsvoll"),
    desc=("Bestill time hos Molí Brow Studio i Eidsvoll: velg behandling, dag og send bestillingen. Du får bekreftelse på SMS eller e-post.",
          "Book at Molí Brow Studio in Eidsvoll: choose a treatment and a day, then send your booking. You get a confirmation by SMS or email."),
    h1=("Bestill time", "Book an appointment"),
    lead=("Velg behandling, dag og send bestillingen. Du får bekreftelse på SMS eller e-post.",
          "Choose a treatment and a day, then send your booking. You get a confirmation by SMS or email."),
)


# Privacy wording used while bookings are handled by Timma (Spokes not enabled). Keys = index in PRIVACY['sections'].
PRIVACY_TIMMA = {
    1: (("Hvilke opplysninger samler vi inn?", "What data do we collect?"),
        ("Når du bestiller time via Timma oppgir du navn, kontaktinformasjon, ønsket behandling og tidspunkt. Nettsiden vår har ingen skjemaer og bruker ikke analyse- eller markedsføringsinfokapsler.",
         "When you book via Timma you provide your name, contact details, the treatment and time you want. This website has no forms and does not use analytics or marketing cookies.")),
    3: (("Hvem får tilgang?", "Who has access?"),
        ("Bestillinger gjøres hos Timma (bestill.timma.no), som behandler opplysningene etter sine egne vilkår og personvernerklæring. Vi selger ikke opplysningene dine.",
         "Bookings are made with Timma (bestill.timma.no), which processes the data under its own terms and privacy policy. We do not sell your data.")),
}
