// Global variables
let currentModel = "flexible";
const width = 1000;
const height = 600;
const svg = d3.select("#visualization")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(40,40)");

const treeLayout = d3.tree().size([width - 80, height - 80]);

// Updated color scale
const colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"];
const colorScale = d3.scaleOrdinal().range(colors);

// Helper functions
function addEmployee(parent, id) {
    const node = { id: id.toString(), children: [] };
    parent.children.push(node);
    return node;
}

function distributeEmployees(employees, managers) {
    const baseReports = Math.floor(employees / managers);
    const extraReports = employees % managers;
    return Array(managers).fill(baseReports).map((reports, index) =>
        index < extraReports ? reports + 1 : reports
    );
}

// Model-specific generator functions
function generateFixedLevels(params) {
  const { total, levels, maxReports } = params;
  let data = { id: "1", children: [] };
  let remainingEmployees = total - 1; // Subtract 1 for the root node
  let currentLevel = [data];
  let nextId = 2;

  // Calculate the ideal number of nodes at each level
  let nodesPerLevel = [1]; // Start with 1 for the root node
  for (let i = 1; i < levels; i++) {
      let nodes = Math.min(Math.pow(maxReports, i), remainingEmployees);
      nodesPerLevel.push(nodes);
      remainingEmployees -= nodes;
  }

  // Distribute remaining employees to the last level
  nodesPerLevel[levels - 1] += remainingEmployees;

  for (let level = 1; level < levels; level++) {
      const newLevel = [];
      const nodesToCreate = nodesPerLevel[level];
      const nodesInCurrentLevel = currentLevel.length;

      // Distribute nodes among parents in the current level
      for (let i = 0; i < nodesToCreate; i++) {
          const parentIndex = i % nodesInCurrentLevel;
          const parent = currentLevel[parentIndex];
          const node = { id: nextId.toString(), children: [] };
          parent.children.push(node);
          newLevel.push(node);
          nextId++;
      }

      currentLevel = newLevel;
  }

  return { data, levels, totalEmployees: total };
}

function getLeafNodes(node) {
  if (!node.children || node.children.length === 0) {
      return [node];
  }
  return node.children.flatMap(getLeafNodes);
}

function generateFlexible(params) {
    const { total, ratio, min, max } = params;
    let data = { id: "1", children: [] };
    let remainingEmployees = total - 1;
    let currentLevel = [data];
    let nextId = 2;
    let levels = 1;

    while (remainingEmployees > 0) {
        const newLevel = [];
        let employeesThisLevel = Math.min(remainingEmployees, currentLevel.length * max);
        let employeesDistributed = 0;

        while (employeesDistributed < employeesThisLevel && remainingEmployees > 0) {
            for (const parent of currentLevel) {
                if (parent.children.length < max && employeesDistributed < employeesThisLevel && remainingEmployees > 0) {
                    const targetReports = Math.min(ratio, max, remainingEmployees);
                    const actualReports = Math.max(min, Math.min(targetReports, max - parent.children.length));

                    for (let i = 0; i < actualReports; i++) {
                        const node = addEmployee(parent, nextId++);
                        newLevel.push(node);
                        remainingEmployees--;
                        employeesDistributed++;

                        if (employeesDistributed >= employeesThisLevel || remainingEmployees === 0) {
                            break;
                        }
                    }
                }
                if (employeesDistributed >= employeesThisLevel || remainingEmployees === 0) {
                    break;
                }
            }
        }

        if (newLevel.length > 0) {
            levels++;
            currentLevel = newLevel;
        } else {
            break;
        }
    }

    return { data, levels };
}

function generateStrict(params) {
    const { total, ratio } = params;
    let data = { id: "1", children: [] };
    let remainingEmployees = total - 1;
    let currentLevel = [data];
    let nextId = 2;
    let levels = 1;

    while (remainingEmployees > 0) {
        const newLevel = [];
        for (const parent of currentLevel) {
            const reports = Math.min(ratio, remainingEmployees);
            for (let i = 0; i < reports; i++) {
                const node = addEmployee(parent, nextId++);
                newLevel.push(node);
                remainingEmployees--;
            }
        }

        if (newLevel.length > 0) {
            levels++;
            currentLevel = newLevel;
        } else {
            break;
        }
    }

    return { data, levels };
}

// Main generator function
function generateHierarchy(model, params) {
  let result;
  switch (model) {
      case "fixedLevels":
          result = generateFixedLevels(params);
          break;
      case "flexible":
          result = generateFlexible(params);
          break;
      case "strict":
          result = generateStrict(params);
          break;
      default:
          throw new Error("Unknown model type");
  }

  // Ensure all employees are accounted for
  let totalNodes = countNodes(result.data);
  if (totalNodes !== params.total) {
      console.warn(`Mismatch in employee count. Expected: ${params.total}, Actual: ${totalNodes}`);
      // Add any missing employees as direct reports to the root
      while (totalNodes < params.total) {
          result.data.children.push({ id: (totalNodes + 1).toString(), children: [] });
          totalNodes++;
      }
  }

  // Double-check the total count
  totalNodes = countNodes(result.data);
  if (totalNodes !== params.total) {
      console.error(`Error: After adjustment, employee count is still incorrect. Expected: ${params.total}, Actual: ${totalNodes}`);
  }

  return result;
}

function countNodes(node) {
  let count = 1;
  if (node.children) {
      for (let child of node.children) {
          count += countNodes(child);
      }
  }
  return count;
}

// Visualization update function
function updateVisualization() {
    let params;
    if (currentModel === "flexible") {
        params = {
            total: parseInt(document.getElementById("flexibleTotal").value),
            ratio: parseInt(document.getElementById("flexibleRatio").value),
            min: parseInt(document.getElementById("flexibleMin").value),
            max: parseInt(document.getElementById("flexibleMax").value)
        };
    } else if (currentModel === "strict") {
        params = {
            total: parseInt(document.getElementById("strictTotal").value),
            ratio: parseInt(document.getElementById("strictRatio").value)
        };
    } else if (currentModel === "fixedLevels") {
        params = {
            total: parseInt(document.getElementById("fixedTotal").value),
            levels: parseInt(document.getElementById("fixedLevels").value),
            maxReports: parseInt(document.getElementById("fixedMaxReports").value)
        };
    }

    const { data, levels, remainingEmployees } = generateHierarchy(currentModel, params);

    // Display warning if there are remaining employees
    if (remainingEmployees > 0) {
        d3.select("#warnings").html(`<p class="warning">Warning: Could not place all employees. ${remainingEmployees} employees unassigned.</p>`);
    } else {
        d3.select("#warnings").html("");
    }

    // Clear previous visualization
    svg.selectAll("*").remove();

    // Generate the nodes and links
    const root = d3.hierarchy(data);
    treeLayout(root);

    // Draw the links
    svg.selectAll(".link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y))
        .attr("fill", "none")
        .attr("stroke", "#555")
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1);

    // Draw the nodes
    const nodes = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    nodes.append("circle")
        .attr("r", 15)
        .attr("fill", d => colorScale(d.depth))
        .style("opacity", 0.5)
        .attr("stroke", "#555")
        .attr("stroke-width", 1);

    nodes.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(d => d.data.id)
        .attr("fill", "black")
        .style("opacity", 0.5)
        .style("font-weight", "bold")
        .style("font-size", "10px");

    // Update legend
    updateLegend(root, params, levels);
}

function updateLegend(root, params, levels) {
  const totalEmployees = params.total;
  const totalManagers = root.descendants().filter(d => d.children && d.children.length > 0).length;
  const nonManagerialStaff = totalEmployees - totalManagers;
  const actualRatio = totalManagers > 0 ? (nonManagerialStaff / totalManagers).toFixed(2) : "N/A";

  let legendHTML = `
      <h3>Organization Summary</h3>
      <div class="legend-item"><span class="legend-label">Model Type:</span> ${currentModel.charAt(0).toUpperCase() + currentModel.slice(1)} Ratio</div>
      <div class="legend-item"><span class="legend-label">Total Employees:</span> ${totalEmployees}</div>
      <div class="legend-item"><span class="legend-label">Total Managers:</span> ${totalManagers}</div>
      <div class="legend-item"><span class="legend-label">Non-Managerial Staff:</span> ${nonManagerialStaff}</div>
      <div class="legend-item"><span class="legend-label">Actual Manager to Staff Ratio:</span> 1:${actualRatio}</div>
      <div class="legend-item"><span class="legend-label">Hierarchy Levels:</span> ${levels}</div>
      <h4>Color Legend</h4>
      <div class="color-legend">
  `;

    for (let i = 0; i < levels; i++) {
        legendHTML += `
            <div class="color-item">
                <span class="color-swatch" style="background-color: ${colorScale(i)}; opacity: 0.5;"></span>
                <span class="color-label">Level ${i + 1}</span>
            </div>
        `;
    }

    legendHTML += '</div>';

    if (currentModel === "flexible") {
        legendHTML += `
            <div class="legend-item"><span class="legend-label">Target Ratio:</span> 1:${params.ratio}</div>
            <div class="legend-item"><span class="legend-label">Min Reports:</span> ${params.min}</div>
            <div class="legend-item"><span class="legend-label">Max Reports:</span> ${params.max}</div>
        `;
    } else if (currentModel === "strict") {
        legendHTML += `
            <div class="legend-item"><span class="legend-label">Strict Ratio:</span> 1:${params.ratio}</div>
        `;
    } else if (currentModel === "fixedLevels") {
        legendHTML += `
            <div class="legend-item"><span class="legend-label">Desired Levels:</span> ${params.levels}</div>
            <div class="legend-item"><span class="legend-label">Max Reports per Manager:</span> ${params.maxReports}</div>
        `;
    }

    d3.select("#legend").html(legendHTML);
}

// Event listeners
document.querySelectorAll('.model-toggle button').forEach(button => {
    button.addEventListener('click', function() {
        document.querySelectorAll('.model-toggle button').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.settings-container').forEach(container => container.classList.remove('active'));
        document.getElementById(this.id.replace('Btn', 'Settings')).classList.add('active');
        currentModel = this.id.replace('Btn', '');
        updateVisualization();
    });
});

document.getElementById("updateBtn").addEventListener("click", updateVisualization);

// Initial visualization
document.addEventListener("DOMContentLoaded", updateVisualization);
