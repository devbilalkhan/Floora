import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 72,
    alignItems: "center",
  },
  logo: {
    width: 160,
    height: 80,
    objectFit: "contain",
    marginBottom: 72,
  },
  quotationFor: {
    fontSize: 17,
    color: "#222222",
    textAlign: "center",
    marginBottom: 18,
  },
  projectLine: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "baseline",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  projectLabel: {
    fontSize: 14,
    color: "#222222",
  },
  projectNameText: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#222222",
  },
  package: {
    fontSize: 14,
    color: "#222222",
    textAlign: "center",
    marginBottom: 52,
  },
  tocHeading: {
    fontSize: 14,
    color: "#222222",
    textAlign: "center",
    marginBottom: 14,
  },
  tocTable: {
    width: "100%",
    border: "1 solid #444444",
  },
  tocRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #444444",
  },
  tocRowLast: {
    flexDirection: "row",
  },
  tocNum: {
    width: 34,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 10,
    color: "#222222",
    textAlign: "center",
    borderRight: "0.5 solid #444444",
  },
  tocLabel: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 10,
    color: "#222222",
  },
});

export type TocSection = { number: number; title: string };

export type CoverPageDocProps = {
  orgLogoUrl: string | null;
  clientName: string;
  projectName: string;
  packageName: string;
  sections: TocSection[];
};

export function CoverPageDoc({
  orgLogoUrl,
  clientName,
  projectName,
  packageName,
  sections,
}: CoverPageDocProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {orgLogoUrl && <Image src={orgLogoUrl} style={s.logo} />}

        <Text style={s.quotationFor}>Quotation For {clientName}</Text>

        <View style={s.projectLine}>
          <Text style={s.projectLabel}>{"Project:  "}</Text>
          <Text style={s.projectNameText}>{projectName}</Text>
        </View>

        <Text style={s.package}>Package: {packageName}</Text>

        <Text style={s.tocHeading}>Table of Content</Text>

        <View style={s.tocTable}>
          {sections.map((sec, i) => (
            <View
              key={sec.number}
              style={i < sections.length - 1 ? s.tocRow : s.tocRowLast}
            >
              <Text style={s.tocNum}>{sec.number}</Text>
              <Text style={s.tocLabel}>{sec.title}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
