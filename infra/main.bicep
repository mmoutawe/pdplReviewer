// main.bicep — Azure infrastructure for PDPL Reviewer
// Deploys: Storage, App Service Plan, Azure Functions App, Application Insights
// Uses an existing Azure OpenAI resource (does not create a new one).

@description('Short environment tag appended to resource names (e.g. dev, test, prod)')
param environment string = 'dev'

@description('Azure region for all resources — use the same region as your OpenAI resource')
param location string = resourceGroup().location

@description('Existing Azure OpenAI endpoint (e.g. https://smartcampaigner.openai.azure.com/)')
param openAiEndpoint string

@description('Existing Azure OpenAI API key — passed securely via CLI, never stored in param files')
@secure()
param openAiKey string = ''

@description('Name of the deployed model inside the OpenAI resource')
param openAiDeploymentName string = 'gpt-5.1'

@description('Dataverse environment URL injected into Functions app settings')
param dataverseUrl string = ''

// ── Naming ────────────────────────────────────────────────────────────────────

var prefix      = 'pdplr'
var suffix      = environment
var storageName = '${prefix}st${suffix}'
var planName    = '${prefix}-plan-${suffix}'
var fnAppName   = '${prefix}-fn-${suffix}'
var aiName      = '${prefix}-ai-${suffix}'

// ── Storage Account ───────────────────────────────────────────────────────────

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

var storageConnStr = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${az.environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'

// ── Log Analytics + Application Insights ─────────────────────────────────────

resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-law-${suffix}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logWorkspace.id
  }
}

// ── App Service Plan (Consumption) ────────────────────────────────────────────

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

// ── Azure Functions App ───────────────────────────────────────────────────────

resource fnApp 'Microsoft.Web/sites@2023-01-01' = {
  name: fnAppName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnStr
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: storageConnStr
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(fnAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openAiEndpoint
        }
        {
          name: 'AZURE_OPENAI_KEY'
          value: openAiKey
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT'
          value: openAiDeploymentName
        }
        {
          name: 'DATAVERSE_URL'
          value: dataverseUrl
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────

@description('Azure Functions base URL — set as VITE_AF_BASE_URL in .env.local and as a Power Pages site setting')
output afBaseUrl string = 'https://${fnApp.properties.defaultHostName}/api'

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString
