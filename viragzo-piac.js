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

const voteCards = document.querySelectorAll(".vote-card");
const voteButton = document.getElementById("voteButton");
const voteError = document.getElementById("voteError");
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

watchIdeas();

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

if (voteButton) {
	voteButton.addEventListener("click", async () => {
		const selectedCards = document.querySelectorAll(".vote-card.selected");

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
