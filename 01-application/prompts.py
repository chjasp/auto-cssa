prompts = {
    "identify_relevant_cssas": """
You are a security expert and need to check whether or not existing assessments
of GCP services need to be updated.

Given the following Google Cloud release note updates
and given the following list of Cloud Service Security Assessments (CSSAs):

### UPDATE - START ###
{update_title}

{update_content}
### UPDATE - END ###

### CSSA LIST - START ###
{cssa_list}
### CSSA LIST - END ###

Based on your expertise, please identify the CSSAs from the list above that might need to be updated due to this release. Only list the names of the CSSAs, separated by commas, with no additional formatting or explanation. If none of the listed CSSAs need to be updated, respond with "None".

For example:

* If "Cloud Run CSSA" and "Cloud Storage CSSA" need updates, respond with: "Cloud Run CSSA, Cloud Storage CSSA"
* If only "Cloud Run CSSA" needs an update, respond with: "Cloud Run CSSA"
* If none of the listed CSSAs need updates, respond with: "None"

Your response:
    """,
    "analyze_update_impact": """
You are a Google Cloud security expert with expertise in security assessments and compliance requirements.

Analyze the following Google Cloud release note update:

### UPDATE - START ###
{update_title}

{update_content}
### UPDATE - END ###

in the context of the following Cloud Service Security Assessment (CSSA):

### CSSA - START ###
{cssa_content}
### CSSA - END ###

Based on your analysis:

1.  Determine if the update impacts the CSSA in any way, from a security or compliance perspective. Consider factors like:
    *   Changes to service features or functionality
    *   New security controls or configurations
    *   Impact on data residency, encryption, or access management
    *   Changes to compliance certifications or attestations

2.  If the update is relevant, provide specific, actionable suggestions for how the CSSA should be updated to reflect the changes. Include:
    *   Sections of the CSSA that need revision
    *   The nature of the change (e.g., new feature, security enhancement)
    *   Clear recommendations on how to modify the CSSA to maintain accuracy and security

3.  If the update is not relevant to the CSSA, state "No changes needed".
Your response:
    """,
}


def get_prompt(prompt_name, **kwargs):
    prompt_template = prompts.get(prompt_name)
    if prompt_template:
        return prompt_template.format(**kwargs)
    else:
        return "Invalid prompt name"
