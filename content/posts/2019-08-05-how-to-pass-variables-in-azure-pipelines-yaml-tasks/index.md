---
title: "How to pass variables in Azure Pipelines YAML tasks"
description: "Passing variables between steps, jobs, and stages: explained"
date: 2019-08-05 19:14:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/pipeline-variables.jpg"
comments: yes
coverImage:
  author: "Chad Madden"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@chadmadden"
---

This is a quick reference on passing variables between multiple tasks in [Azure Pipelines](https://azure.com/pipelines), a popular CI/CD platform. They have recently enabled support for [multi-stage pipelines](https://devblogs.microsoft.com/devops/whats-new-with-azure-pipelines/) defined in YAML documents, allowing the creation of both build and release (CI and CD) pipelines, in a single `azure-pipelines.yaml` file. This is very powerful, as it lets developers define their pipelines to continuously build and deploy apps, using a declarative syntax, and storing the YAML document in the same repo as their code, versioned.

One recurrent question is: how do you pass variables around tasks? While passing variables from a step to another within the same job is relatively easy, sharing state and variables with tasks in other jobs or even stages isn't immediate.

The examples below are about using multi-stage pipelines within YAML documents. I'll focus on pipelines running on Linux, and all examples show bash scripts. The same concepts would apply to developers working with PowerShell or Batch scripts, although the syntax of the commands will be slightly different. The work below is based on the [official documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/process/variables?view=azure-devops&tabs=yaml%2Cbatch#share-variables-across-pipelines), adding some examples and explaining how to pass variables between stages.

## Passing variables between tasks in the same job

This is the easiest one. In a script task, you need to print a special value to STDOUT that will be captured by Azure Pipelines to set the variable.

For example, to pass the variable `FOO` between scripts:

1. Set the value with the command `echo "##vso[task.setvariable variable=FOO]some value"`
1. In subsequent tasks, you can use the `$(FOO)` syntax to have Azure Pipelines replace the variable with `some value`
1. Alternatively, in the following scripts tasks, `FOO` is also set as environmental variable and can be accessed as `$FOO`

Full pipeline example:

````yaml
steps:

  # Sets FOO to be "some value" in the script and the next ones
  - bash: |
      FOO="some value"
      echo "##vso[task.setvariable variable=FOO]$FOO"

  # Using the $() syntax, the value is replaced inside Azure Pipelines before being submitted to the script task
  - bash: |
      echo "$(FOO)"

  # The same variable is also present as environmental variable in scripts; here the variable expansion happens within bash
  - bash: |
      echo "$FOO"
````

You can also use the `$(FOO)` syntax inside task definitions. For example, these steps copy files to a folder whose name is defined as variable:

````yaml
pool:
  vmImage: 'Ubuntu-16.04'

steps:
  - bash: |
      echo "##vso[task.setvariable variable=TARGET_FOLDER]$(Pipeline.Workspace)/target"
  - task: CopyFiles@2
    inputs:
      sourceFolder: $(Build.SourcesDirectory)
      # Note the use of the variable TARGET_FOLDER
      targetFolder: $(TARGET_FOLDER)/myfolder
````

> Wondering why the `vso` label? That's a legacy identifier from when Azure Pipelines used to be part of Visual Studio Online, before being rebranded Visual Studio Team Services, and finally Azure DevOps!

## Passing variables between jobs

Passing variables between jobs *in the same stage* is a bit more complex, as it requires working with output variables.

Similarly to the example above, to pass the `FOO` variable:

1. Make sure you give a name to the job, for example `job: firstjob`
1. Likewise, make sure you give a name to the step as well, for example: `name: mystep`
1. Set the variable with the same command as before, but adding `;isOutput=true`, like: `echo "##vso[task.setvariable variable=FOO;isOutput=true]some value"`
1. In the second job, define a variable at the job level, giving it the value `$[ dependencies.firstjob.outputs['mystep.FOO'] ]` (remember to use single quotes for expressions)

A full example:

````yaml
jobs:
  
  - job: firstjob
    pool:
      vmImage: 'Ubuntu-16.04'
    steps:

      # Sets FOO to "some value", then mark it as output variable
      - bash: |
          FOO="some value"
          echo "##vso[task.setvariable variable=FOO;isOutput=true]$FOO"
        name: mystep

      # Show output variable in the same job
      - bash: |
          echo "$(mystep.FOO)"
  
  - job: secondjob
    # Need to explicitly mark the dependency
    dependsOn: firstjob
    variables:
      # Define the variable FOO from the previous job
      # Note the use of single quotes!
      FOO: $[ dependencies.firstjob.outputs['mystep.FOO'] ]
    pool:
      vmImage: 'Ubuntu-16.04'
    steps:

      # The variable is now available for expansion within the job
      - bash: |
          echo "$(FOO)"

      # To send the variable to the script as environmental variable, it needs to be set in the env dictionary
      - bash: |
          echo "$FOO"
        env:
          FOO: $(FOO)
````

## Passing variables between stages

At this time, it's not possible to pass variables between different stages. There is, however, a workaround that involves writing the variable to disk and then passing it as a file, leveraging [pipeline artifacts](https://docs.microsoft.com/en-us/azure/devops/pipelines/artifacts/pipeline-artifacts?view=azure-devops&tabs=yaml).

To pass the variable `FOO` from a job to another one in a different stage:

1. Create a folder that will contain all variables you want to pass; any folder could work, but something like `mkdir -p $(Pipeline.Workspace)/variables` might be a good idea.
1. Write the contents of the variable to a file, for example `echo "$FOO" > $(Pipeline.Workspace)/variables/FOO`. Even though the name could be anything you'd like, giving the file the same name as the variable might be a good idea.
1. Publish the `$(Pipeline.Workspace)/variables` folder as a pipeline artifact named `variables`
1. In the second stage, download the `variables` pipeline artifact
1. Read each file into a variable, for example `FOO=$(cat $(Pipeline.Workspace)/variables/FOO)`
1. Expose the variable in the current job, just like we did in the first example: `echo "##vso[task.setvariable variable=FOO]$FOO"`
1. You can then access the variable by expanding it within Azure Pipelines (`$(FOO)`) or use it as an environmental variable inside a bash script (`$FOO`).

Example:

````yaml
stages:

  - stage: firststage
    jobs:

      - job: firstjob
        pool:
          vmImage: 'Ubuntu-16.04'
        steps:

          # To pass the variable FOO, write it to a file
          # While the file name doesn't matter, naming it like the variable and putting it inside the $(Pipeline.Workspace)/variables folder could be a good pattern
          - bash: |
              FOO="some value"
              mkdir -p $(Pipeline.Workspace)/variables
              echo "$FOO" > $(Pipeline.Workspace)/variables/FOO

          # Publish the folder as pipeline artifact
          - publish: $(Pipeline.Workspace)/variables
            artifact: variables
  
  - stage: secondstage
    jobs:

      - job: secondjob
        pool:
          vmImage: 'Ubuntu-16.04'
        steps:

          # Download the artifacts
          - download: current
            artifact: variables

          # Read the variable from the file, then expose it in the job
          - bash: |
              FOO=$(cat $(Pipeline.Workspace)/variables/FOO)
              echo "##vso[task.setvariable variable=FOO]$FOO"

          # Just like in the first example, we can expand the variable within Azure Pipelines itself
          - bash: |
              echo "$(FOO)"

          # Or we can expand it within bash, reading it as environmental variable
          - bash: |
              echo "$FOO"
````

Here's the pipeline running. Note in the second stage how line #14 shows `some value` in both bash scripts. However, take a look at the script being executed on line #11: in the first case, the variable was expanded inside Azure Pipelines (so the script became `echo "some value"`), while in the second one bash is reading an environmental variable (the script remains `echo "$FOO"`).

![Screenshot of pipeline running showing the variable expanded](/assets/azp-variable.png)

If you want to pass more than one variable, you can create multiple files within the `$(Pipeline.Workspace)/variables` (e.g. for a variable named `MYVAR`, write it inside `$(Pipeline.Workspace)/variables/MYVAR`), then read all the variables in the second stage.
