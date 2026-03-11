import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getDatabase, onValue, ref, runTransaction } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
	apiKey: "AIzaSyCvl0ZPz3NL2aF6QtuoLCDP4oEvukmgqKk",
	authDomain: "viragzopiac.firebaseapp.com",
	databaseURL: "https://viragzopiac-default-rtdb.europe-west1.firebasedatabase.app",
	projectId: "viragzopiac",
	storageBucket: "viragzopiac.firebasestorage.app",
	messagingSenderId: "115105428449",
	appId: "1:115105428449:web:2bdfcf24911422f5ae58a0",
	measurementId: "G-P7T4DL9NGZ"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function initializeVoting() {
	const voteCards = document.querySelectorAll("#ideasGrid .vote-card");
	const voteButton = document.getElementById("voteButton");
	const voteError = document.getElementById("voteError");
	const innovationCards = document.querySelectorAll("#innovationGrid .vote-card");
	const innovationVoteButton = document.getElementById("innovationVoteButton");
	const innovationError = document.getElementById("innovationError");
	const voterId = getOrCreateVoterId();

 	function getOrCreateVoterId() {
		let storedId = localStorage.getItem("voterId");
		if (!storedId) {
			storedId = typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `voter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
			localStorage.setItem("voterId", storedId);
		}
		return storedId;
	}

	function getInnovationChoice(cardId) {
		return cardId === "innovation-yes" ? "yes" : "no";
	}

	function watchIdeas() {
		const ideasRef = ref(database, "ideas");
		onValue(ideasRef, snapshot => {
			const values = snapshot.val() || {};

			for (const card of voteCards) {
				const id = card.getAttribute("data-id");
				const idea = values[id] || {};
				const voteCountElement = card.querySelector(".vote-count");
				const count = Number(idea.count) || 0;
				const voters = idea.voters && typeof idea.voters === "object" ? idea.voters : {};
				const alreadyVoted = Boolean(voters[voterId]);

				voteCountElement.textContent = String(count);
				card.classList.toggle("voted", alreadyVoted);
				if (alreadyVoted) {
					card.classList.remove("selected");
				}
			}
		});
	}

	function watchInnovation() {
		const innovationRef = ref(database, "innovation");
		onValue(innovationRef, snapshot => {
			const data = snapshot.val() || {};
			const yesCount = Number(data.yesCount) || 0;
			const noCount = Number(data.noCount) || 0;
			const totalCount = yesCount + noCount;
			const voters = data.voters && typeof data.voters === "object" ? data.voters : {};
			const userChoice = voters[voterId] || null;

			for (const card of innovationCards) {
				const cardId = card.getAttribute("data-id");
				const choice = getInnovationChoice(cardId);
				const voteCountElement = card.querySelector(".vote-count");
				const cardCount = choice === "yes" ? yesCount : noCount;
				voteCountElement.textContent = String(cardCount);
				const fillRatio = totalCount > 0 ? cardCount / totalCount : 0;
				card.style.setProperty("--fill-ratio", String(fillRatio));

				const alreadyVoted = userChoice !== null;
				card.classList.toggle("voted", alreadyVoted);
				if (alreadyVoted) {
					card.classList.remove("selected");
				}
			}
		});
	}

	watchIdeas();
	watchInnovation();

	for (const card of voteCards) {
		card.addEventListener("click", () => {
			if (!card.classList.contains("voted")) {
				card.classList.toggle("selected");
				if (voteError) {
					voteError.textContent = "";
				}
			}
		});
	}

	for (const card of innovationCards) {
		card.addEventListener("click", () => {
			if (card.classList.contains("voted")) {
				return;
			}

			for (const otherCard of innovationCards) {
				otherCard.classList.remove("selected");
			}

			card.classList.add("selected");
			if (innovationError) {
				innovationError.textContent = "";
			}
		});
	}

	if (voteButton) {
		voteButton.addEventListener("click", async () => {
			const selectedCards = document.querySelectorAll("#ideasGrid .vote-card.selected");

			if (voteError) {
				voteError.textContent = "";
			}

			if (selectedCards.length === 0) {
				return;
			}

			try {
				let duplicateVoteDetected = false;

				for (const card of selectedCards) {
					const cardId = card.getAttribute("data-id");
					const ideaRef = ref(database, `ideas/${cardId}`);

					const result = await runTransaction(ideaRef, current => {
						const idea = current && typeof current === "object" ? current : {};
						const voters = idea.voters && typeof idea.voters === "object" ? idea.voters : {};
						const count = Number(idea.count) || 0;

						if (voters[voterId]) {
							return;
						}

						return {
							count: count + 1,
							voters: {
								...voters,
								[voterId]: true
							}
						};
					});

					if (!result.committed) {
						duplicateVoteDetected = true;
					}

					card.classList.remove("selected");
				}

				if (duplicateVoteDetected && voteError) {
					voteError.textContent = "Hiba: nem lehet 1-nel tobbszor ugyanarra szavazni!";
				}
			} catch (error) {
				if (voteError) {
					voteError.textContent = "Hiba: a szavazas mentese most nem sikerult.";
				}
			}
		});
	}

	if (innovationVoteButton) {
		innovationVoteButton.addEventListener("click", async () => {
			const selectedCard = document.querySelector("#innovationGrid .vote-card.selected");

			if (innovationError) {
				innovationError.textContent = "";
			}

			if (!selectedCard) {
				return;
			}

			const cardId = selectedCard.getAttribute("data-id");
			const selectedChoice = getInnovationChoice(cardId);
			const innovationRef = ref(database, "innovation");

			try {
				const result = await runTransaction(innovationRef, current => {
					const innovation = current && typeof current === "object" ? current : {};
					const voters = innovation.voters && typeof innovation.voters === "object" ? innovation.voters : {};
					const yesCount = Number(innovation.yesCount) || 0;
					const noCount = Number(innovation.noCount) || 0;

					if (voters[voterId]) {
						return;
					}

					return {
						yesCount: selectedChoice === "yes" ? yesCount + 1 : yesCount,
						noCount: selectedChoice === "no" ? noCount + 1 : noCount,
						voters: {
							...voters,
							[voterId]: selectedChoice
						}
					};
				});

			selectedCard.classList.remove("selected");

			if (!result.committed && innovationError) {
				innovationError.textContent = "Hiba: itt csak egyszer szavazhatsz (igen VAGY nem).";
			}
		} catch (error) {
			if (innovationError) {
				innovationError.textContent = "Hiba: a szavazas mentese most nem sikerult.";
			}
		}
		});
	}

}

function initializePlanToggles() {
	const planItems = document.querySelectorAll(".plan-item");
	const budgetValuesByTitle = {
		"utcazenesz spot": { cost: "Ingyenes", feasibility: "Könnyű" },
		"a ter mozija": { cost: "~1,5-2M Ft", feasibility: "Könnyű" },
		"streetflow": { cost: "~1M Ft", feasibility: "Közepes" },
		"cuccmegorzo": { cost: "~3M Ft (megtérítődik)", feasibility: "Könnyű" },
		"frissitopont": { cost: "<1M Ft", feasibility: "Könnyű" },
		"fotofulke": { cost: "~3-5M Ft", feasibility: "Könnyű" },
		"uj fenyek": { cost: "<1M Ft", feasibility: "Könnyű" },
		"esztetikai ujitas": { cost: "~35M Ft", feasibility: "Nehéz" },
		"skywalk": { cost: "~50-80M Ft", feasibility: "Nagyon Nehéz" }
	};

	const normalizeTitle = text => text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9 ]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const getBudgetTextByTitle = titleText => {
		const normalizedTitle = normalizeTitle(titleText);
		const matchedKey = Object.keys(budgetValuesByTitle).find(key => normalizedTitle.includes(key));
		if (!matchedKey) {
			return "<p class=\"plan-budget-placeholder\">Becsült költség:<br>Megvalósíthatóság:</p>";
		}

		const values = budgetValuesByTitle[matchedKey];
		return `<p class=\"plan-budget-placeholder\">Becsült költség: ${values.cost}<br>Megvalósíthatóság: ${values.feasibility}</p>`;
	};

	for (const item of planItems) {
		const existingTabs = item.querySelector(".plan-tabs");
		if (existingTabs) {
			continue;
		}

		const descriptionElement = item.querySelector(".plan-description");
		if (!descriptionElement) {
			continue;
		}

		const descriptionHtml = descriptionElement.innerHTML;
		const titleText = item.querySelector(".plan-item-title")?.textContent || "";
		descriptionElement.remove();

		const tabsContainer = document.createElement("div");
		tabsContainer.className = "plan-tabs";

		const descriptionToggle = document.createElement("button");
		descriptionToggle.type = "button";
		descriptionToggle.className = "plan-tab-toggle";
		descriptionToggle.setAttribute("aria-expanded", "false");
		descriptionToggle.innerHTML = "<span class=\"plan-tab-label\">Leírás</span><span class=\"plan-chevron\">&gt;</span>";

		const descriptionPanel = document.createElement("div");
		descriptionPanel.className = "plan-tab-panel";
		descriptionPanel.innerHTML = `<p class=\"plan-description\">${descriptionHtml}</p>`;

		const budgetToggle = document.createElement("button");
		budgetToggle.type = "button";
		budgetToggle.className = "plan-tab-toggle";
		budgetToggle.setAttribute("aria-expanded", "false");
		budgetToggle.innerHTML = "<span class=\"plan-tab-label\">Költségvetés</span><span class=\"plan-chevron\">&gt;</span>";

		const budgetPanel = document.createElement("div");
		budgetPanel.className = "plan-tab-panel";
		budgetPanel.innerHTML = getBudgetTextByTitle(titleText);

		const attachToggle = (toggleButton, panel) => {
			panel.addEventListener("transitionend", event => {
				if (event.propertyName !== "max-height") {
					return;
				}

				if (panel.classList.contains("open")) {
					panel.style.maxHeight = "none";
				}
			});

			toggleButton.addEventListener("click", () => {
				const isOpen = toggleButton.classList.contains("open");
				toggleButton.classList.toggle("open", !isOpen);
				toggleButton.setAttribute("aria-expanded", String(!isOpen));

				if (!isOpen) {
					panel.classList.add("open");
					panel.style.maxHeight = "0px";
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							panel.style.maxHeight = `${panel.scrollHeight}px`;
						});
					});
				} else {
					if (panel.style.maxHeight === "none") {
						panel.style.maxHeight = `${panel.scrollHeight}px`;
					}

					requestAnimationFrame(() => {
						panel.style.maxHeight = "0px";
						panel.classList.remove("open");
					});
				}
			});
		};

		attachToggle(descriptionToggle, descriptionPanel);
		attachToggle(budgetToggle, budgetPanel);

		tabsContainer.append(descriptionToggle, descriptionPanel, budgetToggle, budgetPanel);
		item.appendChild(tabsContainer);
	}
}

function initializeBeforeAfterSliders() {
	const sliders = document.querySelectorAll(".before-after-slider");

	for (const slider of sliders) {
		const range = slider.querySelector(".before-after-range");
		if (!range) {
			continue;
		}

		let frameId = null;
		const updateSplit = () => {
			slider.style.setProperty("--split", `${range.value}%`);
			frameId = null;
		};

		range.addEventListener("input", () => {
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
			}
			frameId = requestAnimationFrame(updateSplit);
		});

		updateSplit();
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		initializeVoting();
		initializePlanToggles();
		initializeBeforeAfterSliders();
	});
} else {
	initializeVoting();
	initializePlanToggles();
	initializeBeforeAfterSliders();
}
