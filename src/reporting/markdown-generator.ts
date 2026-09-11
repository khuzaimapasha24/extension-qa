import { QAReportData } from './report-types';

/**
 * Generates a clean, professional GitHub Flavored Markdown QA report
 * suitable for GitHub Issues, PR summaries, or Jira tickets.
 */
export function generateMarkdownReport(data: QAReportData): string {
  const { metadata, summary, scores, findings } = data;

  const scoreBadge =
    summary.overallScore >= 90
      ? '🟢 EXCELLENT'
      : summary.overallScore >= 75
        ? '🟡 GOOD'
        : summary.overallScore >= 50
          ? '🟠 NEEDS IMPROVEMENT'
          : '🔴 CRITICAL';

  let md = `# 🛡️ QA Audit Report: ${metadata.title || metadata.url}\n\n`;
  md += `> **Target**: [${metadata.url}](${metadata.url})  \n`;
  md += `> **Generated**: ${metadata.formattedDate} | **Engine**: AI QA Agent v${metadata.engineVersion}\n\n`;

  // Executive Summary Card
  md += `## 📊 Executive Summary\n\n`;
  md += `| Overall Quality Score | Rating | Tests Executed | Pages Audited | Interactive Elements |\n`;
  md += `| :---: | :---: | :---: | :---: | :---: |\n`;
  md += `| **${summary.overallScore} / 100** | **${scoreBadge}** | **${summary.testsExecuted}** | **${summary.pagesScanned}** | **${summary.elementsScanned}** |\n\n`;

  // Defect Severity Breakdown
  md += `### 🚨 Defect Breakdown\n\n`;
  md += `- **Critical Bugs**: ${summary.criticalCount} 🔴\n`;
  md += `- **High Severity**: ${summary.highCount} 🟠\n`;
  md += `- **Medium Warnings**: ${summary.mediumCount} 🟡\n`;
  md += `- **Low / Info**: ${summary.lowCount + summary.infoCount} 🔵\n`;
  md += `- **Total Findings**: ${summary.totalFindings}\n\n`;

  // Category Scores Table
  md += `### 📈 Category Breakdown\n\n`;
  md += `| Category | Score | Weight | Passed | Failed | Warnings |\n`;
  md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const [cat, val] of Object.entries(scores.categoryScores)) {
    const statusIcon = val.score >= 85 ? '✅' : val.score >= 60 ? '⚠️' : '❌';
    md += `| ${statusIcon} **${cat}** | ${val.score}% | ${val.weight}% | ${val.passedCount} | ${val.failedCount} | ${val.warningsCount} |\n`;
  }
  md += `\n---\n\n`;

  if (data.flowAnalysis) {
    const fa = data.flowAnalysis;
    md += `## 🧭 Website Flow & UX Journey Critique\n\n`;
    md += `- **Page Intent**: ${fa.pageIntent}\n`;
    md += `- **Flow Health Score**: ${fa.flowScore}/100 (${fa.flowRating})\n`;
    md += `- **Evaluated By**: ${fa.evaluatedBy}\n\n`;
    md += `> ${fa.summary}\n\n`;

    if (fa.strengths && fa.strengths.length > 0) {
      md += `### Flow Strengths\n`;
      for (const s of fa.strengths) {
        md += `- ✅ ${s}\n`;
      }
      md += `\n`;
    }

    if (fa.frictionPoints && fa.frictionPoints.length > 0) {
      md += `### User Journey Friction Points\n`;
      for (const fp of fa.frictionPoints) {
        md += `- **[${fp.severity}] ${fp.title}**: ${fp.description}\n`;
      }
      md += `\n`;
    }

    if (fa.recommendations && fa.recommendations.length > 0) {
      md += `### Actionable Flow Improvement Recommendations\n\n`;
      for (const rec of fa.recommendations) {
        md += `#### 💡 [${rec.priority} Priority] ${rec.title}\n`;
        md += `- **Flow Friction**: ${rec.currentFlowIssue}\n`;
        md += `- **Actionable Fix**: ${rec.suggestedImprovement}\n`;
        md += `- **Expected Impact**: ${rec.expectedImpact}\n\n`;
      }
    }
    md += `---\n\n`;
  }

  // Findings Section
  md += `## 🔍 Detected Findings (${summary.totalFindings})\n\n`;

  if (findings.length === 0) {
    md += `🎉 **Zero defects detected! All automated deterministic and interactive suites passed with flying colors.**\n\n`;
  } else {
    // Group findings by category
    const categories = ['FUNCTIONAL', 'ACCESSIBILITY', 'PERFORMANCE', 'RESPONSIVE', 'SEO', 'CONSOLE', 'NETWORK', 'UX'] as const;

    for (const cat of categories) {
      const catFindings = findings.filter((f) => f.category === cat);
      if (catFindings.length === 0) continue;

      md += `### ${cat} (${catFindings.length})\n\n`;

      for (const f of catFindings) {
        const sevBadge =
          f.severity === 'CRITICAL'
            ? '🔴 CRITICAL'
            : f.severity === 'HIGH'
              ? '🟠 HIGH'
              : f.severity === 'MEDIUM'
                ? '🟡 MEDIUM'
                : '🔵 LOW';

        md += `#### [${sevBadge}] ${f.title}\n\n`;
        md += `**Description**: ${f.description}\n\n`;
        md += `- **Target Element**: \`${f.selector || 'N/A'}\`\n`;
        md += `- **Page Route**: \`${f.page}\`\n`;
        md += `- **Expected**: ${f.expected}\n`;
        md += `- **Actual**: ${f.actual}\n`;
        md += `- **Confidence**: ${Math.round(f.confidence * 100)}%\n\n`;

        if (f.recommendation) {
          md += `💡 **Remediation Recommendation**:\n> ${f.recommendation}\n\n`;
        }

        // Evidence details
        const domEvidence = f.evidence.find((e) => e.type === 'dom_snippet');
        const consoleEvidence = f.evidence.find((e) => e.type === 'console_error');
        const netEvidence = f.evidence.find((e) => e.type === 'network_error');

        if (domEvidence || consoleEvidence || netEvidence) {
          md += `<details>\n<summary>🔬 Technical Evidence</summary>\n\n`;

          if (domEvidence) {
            md += `**DOM Snippet**:\n\`\`\`html\n${domEvidence.data}\n\`\`\`\n\n`;
          }
          if (consoleEvidence) {
            md += `**Console Error Trace**:\n\`\`\`\n${JSON.stringify(consoleEvidence.data, null, 2)}\n\`\`\`\n\n`;
          }
          if (netEvidence) {
            md += `**Network Trace**:\n\`\`\`\n${JSON.stringify(netEvidence.data, null, 2)}\n\`\`\`\n\n`;
          }

          md += `</details>\n\n`;
        }

        md += `---\n\n`;
      }
    }
  }

  // Footer
  md += `*Report generated automatically by [AI Website QA Agent](https://github.com). Strictly client-side verification.*`;

  return md;
}
