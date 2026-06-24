// main.bicepparam — environment-specific values for PDPL Reviewer infrastructure
// openAiKey is NOT stored here — it is fetched from Azure and passed on the CLI by deploy.ps1
using './main.bicep'

param environment         = 'dev'
param location            = 'westeurope'
param openAiEndpoint      = 'https://smartcampaigner.openai.azure.com/'
param openAiDeploymentName = 'gpt-5.1'
param dataverseUrl        = 'https://orgd19a3059.crm4.dynamics.com'
